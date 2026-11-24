/*:
 * @plugindesc 仿神魔之塔風格的卡片式隊伍編組介面 (剔除空白無名角色 + 僅顯示已獲得 + 4人隊伍)
 * @author 你的名字
 *
 * @param MaxCols
 * @text 背包每行卡片數
 * @desc 下方角色背包網格，每行顯示幾張卡片（手機建議 4）。
 * @type number
 * @default 4
 *
 * @param CardSize
 * @text 卡片頭像大小
 * @desc 每張角色卡片內頭像的顯示像素大小（建議 72 ~ 96）。
 * @type number
 * @default 84
 *
 * @param ExcludedActorIds
 * @text 自動剔除角色ID清單
 * @desc 開啟背包時自動排除的角色 ID，以逗號分隔（例如：163 或 12,163）。空白/無名角色也會自動剔除。
 * @type string
 * @default 163
 *
 * @param AwakeningSkillMap
 * @text 覺醒判定技能對應表
 * @desc 填入「角色ID:技能ID」以逗號分隔，例如：42:120,43:125。只要角色學會該技能即視為「已覺醒」。
 * @type string
 * @default
 *
 * @param DefaultAwakeningSkills
 * @text 通用覺醒技能ID清單
 * @desc 若未在上方個別指定，只要角色學會任一個此處列出的技能 ID（逗號分隔），也會視為已覺醒。
 * @type string
 * @default
 *
 * @param HookFormation
 * @text 取代主選單「隊形」
 * @desc 選擇「隊形」時直接開啟神魔風隊伍編組（true / false）。
 * @type boolean
 * @default true
 *
 * @help
 * ----------------------------------------------------------------------------
 * 【使用說明】
 * 1. 自動剔除規則：
 *    - 剔除參數 ExcludedActorIds 中指定的角色 ID（預設 163）。
 *    - 自動剔除資料庫中「沒有名稱」的空白角色格（避免出現只有 Lv.1 的空格）。
 * 2. 只顯示已獲得角色：
 *    - 初始隊伍成員與透過事件加入、或使用 UnlockTOSActor 解鎖的角色，
 *      才會出現在下方網格中；未獲得的角色不會顯示。
 * 3. 外掛指令：
 *    - OpenTOSParty          開啟編隊介面
 *    - UnlockTOSActor ID     將指定角色加入已獲得清單
 *    - LockTOSActor ID       將指定角色從已獲得清單移除
 * ----------------------------------------------------------------------------
 */

(function() {
    var parameters = PluginManager.parameters('TowerOfSaviorsParty');
    var maxCols = Number(parameters['MaxCols'] || 4);
    var cardSize = Number(parameters['CardSize'] || 84);
    var maxParty = 4;

    var excludedRaw = String(parameters['ExcludedActorIds'] || '163');
    var awakenMapRaw = String(parameters['AwakeningSkillMap'] || '');
    var defaultAwakenSkillsRaw = String(parameters['DefaultAwakeningSkills'] || '');
    var hookFormation = String(parameters['HookFormation'] || 'true') === 'true';

    var CATEGORY_MODES = [
        { key: 'obtain',     label: '入手時間' },
        { key: 'atk',        label: '攻擊力' },
        { key: 'def',        label: '防禦力' },
        { key: 'mhp',        label: '生命力' },
        { key: 'mat',        label: '魔法攻擊力' },
        { key: 'awakened',   label: '已覺醒' },
        { key: 'unawakened', label: '未覺醒' }
    ];

    function parseExcludedIds() {
        return excludedRaw.split(',')
            .map(function(s) { return Number(s.trim()); })
            .filter(function(n) { return !isNaN(n) && n > 0; });
    }

    function parseSkillIdList(raw) {
        if (!raw || !raw.trim()) return [];
        return raw.split(',')
            .map(function(s) { return Number(s.trim()); })
            .filter(function(n) { return !isNaN(n) && n > 0; });
    }

    function parseAwakeningSkillMap() {
        var map = {};
        if (!awakenMapRaw.trim()) return map;
        awakenMapRaw.split(',').forEach(function(pair) {
            var parts = pair.split(':');
            if (parts.length === 2) {
                var actorId = Number(parts[0].trim());
                var skillId = Number(parts[1].trim());
                if (actorId > 0 && skillId > 0) {
                    map[actorId] = skillId;
                }
            }
        });
        return map;
    }

    var EXCLUDED_IDS = parseExcludedIds();
    var AWAKENING_SKILL_MAP = parseAwakeningSkillMap();
    var DEFAULT_AWAKEN_SKILLS = parseSkillIdList(defaultAwakenSkillsRaw);

    // 判斷是否為無效/空白/指定剔除的角色
    function isInvalidOrExcludedActor(actorId) {
        if (!actorId || actorId <= 0) return true;
        if (EXCLUDED_IDS.indexOf(actorId) !== -1) return true;

        var dActor = $dataActors && $dataActors[actorId];
        if (!dActor || !dActor.name || dActor.name.trim() === '') {
            return true;
        }

        var gActor = $gameActors && $gameActors.actor(actorId);
        if (!gActor || !gActor.name() || gActor.name().trim() === '') {
            return true;
        }

        return false;
    }

    function drawScaledActorFace(targetBitmap, faceName, faceIndex, dx, dy, dw, dh) {
        if (!faceName) return;
        var srcBitmap = ImageManager.loadFace(faceName);
        var sw = Window_Base._faceWidth || 144;
        var sh = Window_Base._faceHeight || 144;
        var sx = (faceIndex % 4) * sw;
        var sy = Math.floor(faceIndex / 4) * sh;

        var drawAction = function() {
            targetBitmap.blt(srcBitmap, sx, sy, sw, sh, dx, dy, dw, dh);
        };

        if (srcBitmap.isReady()) {
            drawAction();
        } else {
            srcBitmap.addLoadListener(drawAction);
        }
    }

    function actorHasSkill(actor, skillId) {
        if (!actor || !skillId) return false;
        return actor.isLearnedSkill(skillId) || actor.skills().some(function(sk) {
            return sk && sk.id === skillId;
        });
    }

    function isActorAwakened(actor) {
        if (!actor) return false;
        var actorId = actor.actorId();
        var dataActor = $dataActors[actorId];

        if (AWAKENING_SKILL_MAP[actorId]) {
            return actorHasSkill(actor, AWAKENING_SKILL_MAP[actorId]);
        }

        if (dataActor && dataActor.note) {
            var match = dataActor.note.match(/<AwakenSkill:\s*(\d+)>/i);
            if (match && match[1]) {
                return actorHasSkill(actor, Number(match[1]));
            }
            if (/<awakened>|<已覺醒>/i.test(dataActor.note)) {
                return true;
            }
        }

        if (DEFAULT_AWAKEN_SKILLS.length > 0) {
            for (var i = 0; i < DEFAULT_AWAKEN_SKILLS.length; i++) {
                if (actorHasSkill(actor, DEFAULT_AWAKEN_SKILLS[i])) {
                    return true;
                }
            }
            return false;
        }

        return actor.skills().some(function(sk) {
            return sk && sk.name && sk.name.indexOf('覺醒') !== -1;
        });
    }

    function isPointInsideWindow(win, x, y) {
        if (!win || !win.visible) return false;
        return x >= win.x && x <= win.x + win.width &&
               y >= win.y && y <= win.y + win.height;
    }

    // ------------------------------------------------------------------------
    // 擴充 Game_Party
    // ------------------------------------------------------------------------
    var _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.call(this);
        this._tosOwnedActors = [];
        this._tosCategoryKey = 'obtain';
    };

    Game_Party.prototype.tosCategoryKey = function() {
        return this._tosCategoryKey || 'obtain';
    };

    Game_Party.prototype.setTosCategoryKey = function(key) {
        this._tosCategoryKey = key;
    };

    Game_Party.prototype.cleanupExcludedActors = function() {
        var self = this;
        if (!this._tosOwnedActors) {
            this._tosOwnedActors = [];
        }

        // 剔除排除清單與空白無名角色，並去除重複
        var cleanedOwned = [];
        this._tosOwnedActors.forEach(function(id) {
            if (!isInvalidOrExcludedActor(id) && cleanedOwned.indexOf(id) === -1) {
                cleanedOwned.push(id);
            }
        });

        this._actors.forEach(function(actorId) {
            if (!isInvalidOrExcludedActor(actorId) && cleanedOwned.indexOf(actorId) === -1) {
                cleanedOwned.push(actorId);
            }
        });
        this._tosOwnedActors = cleanedOwned;

        this._actors = this._actors.filter(function(actorId) {
            return !isInvalidOrExcludedActor(actorId);
        });
        while (this._actors.length > maxParty) {
            this._actors.pop();
        }
    };

    Game_Party.prototype.tosOwnedActors = function() {
        this.cleanupExcludedActors();
        return this._tosOwnedActors.slice();
    };

    Game_Party.prototype.unlockTosActor = function(actorId) {
        if (isInvalidOrExcludedActor(actorId)) return;
        this.cleanupExcludedActors();
        if (this._tosOwnedActors.indexOf(actorId) === -1) {
            this._tosOwnedActors.push(actorId);
        }
    };

    Game_Party.prototype.lockTosActor = function(actorId) {
        this.cleanupExcludedActors();
        var idx = this._tosOwnedActors.indexOf(actorId);
        if (idx !== -1) {
            this._tosOwnedActors.splice(idx, 1);
        }
        var partyIdx = this._actors.indexOf(actorId);
        if (partyIdx !== -1 && this._actors.length > 1) {
            this._actors.splice(partyIdx, 1);
        }
    };

    var _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function(actorId) {
        if (isInvalidOrExcludedActor(actorId)) return;
        this.unlockTosActor(actorId);
        _Game_Party_addActor.call(this, actorId);
        while (this._actors.length > maxParty) {
            this._actors.pop();
        }
    };

    // ------------------------------------------------------------------------
    // 1. 類別切換列視窗
    // ------------------------------------------------------------------------
    function Window_TOSCategoryBar() {
        this.initialize.apply(this, arguments);
    }

    Window_TOSCategoryBar.prototype = Object.create(Window_Base.prototype);
    Window_TOSCategoryBar.prototype.constructor = Window_TOSCategoryBar;

    Window_TOSCategoryBar.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
    };

    Window_TOSCategoryBar.prototype.refresh = function() {
        this.contents.clear();
        var key = $gameParty.tosCategoryKey();
        var mode = CATEGORY_MODES.find(function(m) { return m.key === key; }) || CATEGORY_MODES[0];

        var w = this.contentsWidth();
        var h = this.contentsHeight();

        this.contents.fillRect(2, 2, w - 4, h - 4, 'rgba(45, 65, 105, 0.92)');
        this.contents.fontSize = 18;
        this.changeTextColor('#ffd700');
        this.drawText('▼ 類別：' + mode.label + ' [點此切換]', 8, Math.floor((h - 24) / 2), w - 16, 'center');
    };

    // ------------------------------------------------------------------------
    // 2. 類別選單視窗
    // ------------------------------------------------------------------------
    function Window_TOSCategoryMenu() {
        this.initialize.apply(this, arguments);
    }

    Window_TOSCategoryMenu.prototype = Object.create(Window_Command.prototype);
    Window_TOSCategoryMenu.prototype.constructor = Window_TOSCategoryMenu;

    Window_TOSCategoryMenu.prototype.initialize = function(x, y, width) {
        this._menuWidth = width || 230;
        Window_Command.prototype.initialize.call(this, x, y);
        this.hide();
        this.deactivate();
    };

    Window_TOSCategoryMenu.prototype.windowWidth = function() {
        return this._menuWidth;
    };

    Window_TOSCategoryMenu.prototype.makeCommandList = function() {
        var currentKey = $gameParty.tosCategoryKey();
        CATEGORY_MODES.forEach(function(m) {
            var prefix = (m.key === currentKey) ? '★ ' : '';
            this.addCommand(prefix + m.label, m.key, true);
        }, this);
    };

    // ------------------------------------------------------------------------
    // 3. 上方：目前隊伍欄位視窗（固定 4 人）
    // ------------------------------------------------------------------------
    function Window_TOSPartySlots() {
        this.initialize.apply(this, arguments);
    }

    Window_TOSPartySlots.prototype = Object.create(Window_Selectable.prototype);
    Window_TOSPartySlots.prototype.constructor = Window_TOSPartySlots;

    Window_TOSPartySlots.prototype.initialize = function(x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this._selectedSlot = 0;
        this.refresh();
    };

    Window_TOSPartySlots.prototype.maxCols = function() {
        return 4;
    };

    Window_TOSPartySlots.prototype.maxItems = function() {
        return 4;
    };

    Window_TOSPartySlots.prototype.itemWidth = function() {
        return Math.floor((this.contentsWidth() - this.spacing() * 3) / 4);
    };

    Window_TOSPartySlots.prototype.itemHeight = function() {
        return this.contentsHeight();
    };

    Window_TOSPartySlots.prototype.spacing = function() {
        return 10;
    };

    Window_TOSPartySlots.prototype.drawItem = function(index) {
        var rect = this.itemRectForText(index);
        var actor = $gameParty.members()[index] || null;

        this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, 'rgba(30, 35, 50, 0.85)');
        if (index === this._selectedSlot) {
            this.contents.fillRect(rect.x, rect.y, rect.width, 4, '#ffd700');
            this.contents.fillRect(rect.x, rect.y + rect.height - 4, rect.width, 4, '#ffd700');
        }

        this.contents.fontSize = 15;
        this.changeTextColor(index === 0 ? '#ffd700' : this.normalColor());
        var roleLabel = (index === 0) ? '隊長' : ('隊員 ' + (index + 1));
        this.drawText(roleLabel, rect.x + 4, rect.y + 2, rect.width - 8, 'left');

        if (actor && !isInvalidOrExcludedActor(actor.actorId())) {
            var faceSize = Math.min(rect.width - 12, rect.height - 46, cardSize);
            var faceX = rect.x + Math.floor((rect.width - faceSize) / 2);
            var faceY = rect.y + 22;
            drawScaledActorFace(this.contents, actor.faceName(), actor.faceIndex(), faceX, faceY, faceSize, faceSize);

            this.contents.fontSize = 14;
            this.changeTextColor(this.normalColor());
            this.drawText(actor.name(), rect.x + 2, rect.y + rect.height - 22, rect.width - 4, 'center');
        } else {
            this.contents.fontSize = 16;
            this.changeTextColor(this.normalColor());
            this.drawText('空位', rect.x, rect.y + Math.floor(rect.height / 2) - 8, rect.width, 'center');
        }
    };

    Window_TOSPartySlots.prototype.selectedSlot = function() {
        return this._selectedSlot;
    };

    Window_TOSPartySlots.prototype.setSelectedSlot = function(slot) {
        this._selectedSlot = Math.max(0, Math.min(3, slot));
        this.refresh();
    };

    // ------------------------------------------------------------------------
    // 4. 下方：已獲得角色卡片網格視窗
    // ------------------------------------------------------------------------
    function Window_TOSActorGrid() {
        this.initialize.apply(this, arguments);
    }

    Window_TOSActorGrid.prototype = Object.create(Window_Selectable.prototype);
    Window_TOSActorGrid.prototype.constructor = Window_TOSActorGrid;

    Window_TOSActorGrid.prototype.initialize = function(x, y, width, height) {
        this._actorIds = this.buildFilteredSortedActorIds();
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
        if (this.maxItems() > 0) {
            this.select(0);
        }
        this.activate();
    };

    Window_TOSActorGrid.prototype.buildFilteredSortedActorIds = function() {
        var ownedIds = $gameParty.tosOwnedActors();
        var category = $gameParty.tosCategoryKey();

        var list = ownedIds.filter(function(id) {
            if (isInvalidOrExcludedActor(id)) return false;
            var actor = $gameActors.actor(id);
            if (!actor) return false;
            if (category === 'awakened') {
                return isActorAwakened(actor);
            }
            if (category === 'unawakened') {
                return !isActorAwakened(actor);
            }
            return true;
        });

        if (category === 'atk') {
            list.sort(function(a, b) {
                return $gameActors.actor(b).atk - $gameActors.actor(a).atk;
            });
        } else if (category === 'def') {
            list.sort(function(a, b) {
                return $gameActors.actor(b).def - $gameActors.actor(a).def;
            });
        } else if (category === 'mhp') {
            list.sort(function(a, b) {
                return $gameActors.actor(b).mhp - $gameActors.actor(a).mhp;
            });
        } else if (category === 'mat') {
            list.sort(function(a, b) {
                return $gameActors.actor(b).mat - $gameActors.actor(a).mat;
            });
        }

        return list;
    };

    Window_TOSActorGrid.prototype.refresh = function() {
        this._actorIds = this.buildFilteredSortedActorIds();
        Window_Selectable.prototype.refresh.call(this);
        if (this.maxItems() === 0) {
            this.select(-1);
        } else if (this.index() < 0 || this.index() >= this.maxItems()) {
            this.select(0);
        }
        this.drawScrollbar();
    };

    Window_TOSActorGrid.prototype.setTopRow = function(row) {
        Window_Selectable.prototype.setTopRow.call(this, row);
        this.drawScrollbar();
    };

    Window_TOSActorGrid.prototype.drawScrollbar = function() {
        var totalRows = Math.ceil(this.maxItems() / this.maxCols());
        var visibleRows = Math.max(1, Math.floor(this.contentsHeight() / this.itemHeight()));
        var barWidth = 8;
        var barX = this.contentsWidth() - barWidth - 2;
        var trackHeight = this.contentsHeight() - 8;

        this.contents.clearRect(barX - 2, 0, barWidth + 4, this.contentsHeight());
        if (totalRows <= visibleRows) return;

        this.contents.fillRect(barX, 4, barWidth, trackHeight, 'rgba(255, 255, 255, 0.14)');

        var thumbHeight = Math.max(24, Math.floor(trackHeight * (visibleRows / totalRows)));
        var maxTopRow = Math.max(1, totalRows - visibleRows);
        var ratio = Math.min(1, Math.max(0, this.topRow() / maxTopRow));
        var thumbY = 4 + Math.floor((trackHeight - thumbHeight) * ratio);

        this.contents.fillRect(barX, thumbY, barWidth, thumbHeight, 'rgba(255, 215, 0, 0.78)');
    };

    Window_TOSActorGrid.prototype.maxCols = function() {
        return maxCols;
    };

    Window_TOSActorGrid.prototype.maxItems = function() {
        return this._actorIds ? this._actorIds.length : 0;
    };

    Window_TOSActorGrid.prototype.spacing = function() {
        return 8;
    };

    Window_TOSActorGrid.prototype.itemWidth = function() {
        var usableW = this.contentsWidth() - 16 - this.spacing() * (this.maxCols() - 1);
        return Math.max(64, Math.floor(usableW / this.maxCols()));
    };

    Window_TOSActorGrid.prototype.itemHeight = function() {
        return cardSize + 30;
    };

    Window_TOSActorGrid.prototype.drawItem = function(index) {
        var actorId = this._actorIds[index];
        var actor = $gameActors.actor(actorId);
        if (!actor || isInvalidOrExcludedActor(actorId)) return;

        var rect = this.itemRect(index);
        var isInParty = $gameParty.members().some(function(m) {
            return m.actorId() === actorId;
        });

        this.contents.fillRect(
            rect.x + 2,
            rect.y + 2,
            rect.width - 4,
            rect.height - 4,
            isInParty ? 'rgba(255, 190, 40, 0.25)' : 'rgba(25, 28, 38, 0.85)'
        );

        var drawSize = Math.min(cardSize, rect.width - 12, rect.height - 28);
        var fx = rect.x + Math.floor((rect.width - drawSize) / 2);
        var fy = rect.y + 6;
        drawScaledActorFace(this.contents, actor.faceName(), actor.faceIndex(), fx, fy, drawSize, drawSize);

        if (isInParty) {
            this.contents.fillRect(rect.x + rect.width - 48, rect.y + 4, 44, 18, 'rgba(0, 0, 0, 0.78)');
            this.contents.fontSize = 12;
            this.changeTextColor('#ffd700');
            this.drawText('使用中', rect.x + rect.width - 48, rect.y + 2, 44, 'center');
        }

        this.contents.fontSize = 13;
        this.changeTextColor(isInParty ? '#ffd700' : this.normalColor());
        this.drawText('Lv.' + actor.level + ' ' + actor.name(), rect.x + 4, rect.y + rect.height - 22, rect.width - 8, 'center');
    };

    Window_TOSActorGrid.prototype.currentActorId = function() {
        return this._actorIds[this.index()] || null;
    };

    // ------------------------------------------------------------------------
    // 5. 整合場景 Scene_TOSParty
    // ------------------------------------------------------------------------
    function Scene_TOSParty() {
        this.initialize.apply(this, arguments);
    }

    Scene_TOSParty.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_TOSParty.prototype.constructor = Scene_TOSParty;

    Scene_TOSParty.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
        $gameParty.cleanupExcludedActors();
    };

    Scene_TOSParty.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createHelpWindow();
        this.createCategoryBarWindow();
        this.createPartySlotsWindow();
        this.createActorGridWindow();
        this.createCategoryMenuWindow();
        this.updateHelpText();
    };

    Scene_TOSParty.prototype.createCategoryBarWindow = function() {
        var wy = this._helpWindow.height;
        var wh = 54;
        var bw = Math.min(320, Math.floor(Graphics.boxWidth * 0.55));
        var bx = Graphics.boxWidth - bw;
        this._categoryBar = new Window_TOSCategoryBar(bx, wy, bw, wh);
        this.addWindow(this._categoryBar);
    };

    Scene_TOSParty.prototype.createPartySlotsWindow = function() {
        var wy = this._categoryBar.y + this._categoryBar.height;
        var wh = 175;
        this._slotsWindow = new Window_TOSPartySlots(0, wy, Graphics.boxWidth, wh);
        this._slotsWindow.setHandler('ok', this.onSlotOk.bind(this));
        this._slotsWindow.setHandler('cancel', this.popScene.bind(this));
        this._slotsWindow.deactivate();
        this.addWindow(this._slotsWindow);
    };

    Scene_TOSParty.prototype.createActorGridWindow = function() {
        var wy = this._slotsWindow.y + this._slotsWindow.height;
        var wh = Graphics.boxHeight - wy;
        this._gridWindow = new Window_TOSActorGrid(0, wy, Graphics.boxWidth, wh);
        this._gridWindow.setHandler('ok', this.onGridOk.bind(this));
        this._gridWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._gridWindow);
    };

    Scene_TOSParty.prototype.createCategoryMenuWindow = function() {
        var mw = 230;
        var mx = Math.max(0, Graphics.boxWidth - mw - 8);
        var my = this._categoryBar.y + this._categoryBar.height;
        this._categoryMenu = new Window_TOSCategoryMenu(mx, my, mw);
        this._categoryMenu.setHandler('cancel', this.closeCategoryMenu.bind(this));

        CATEGORY_MODES.forEach(function(m) {
            this._categoryMenu.setHandler(m.key, this.onCategorySelect.bind(this, m.key));
        }, this);

        this.addWindow(this._categoryMenu);
    };

    Scene_TOSParty.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);

        if (TouchInput.isTriggered()) {
            var tx = TouchInput.x;
            var ty = TouchInput.y;

            if (this._categoryMenu && this._categoryMenu.visible && this._categoryMenu.active) {
                if (!isPointInsideWindow(this._categoryMenu, tx, ty)) {
                    this.closeCategoryMenu();
                    return;
                }
            } else {
                if (isPointInsideWindow(this._categoryBar, tx, ty)) {
                    this.openCategoryMenu();
                    return;
                }

                if (isPointInsideWindow(this._slotsWindow, tx, ty)) {
                    var localX = tx - this._slotsWindow.x - this._slotsWindow.padding;
                    var itemW = this._slotsWindow.itemWidth() + this._slotsWindow.spacing();
                    var clickedSlot = Math.floor(localX / itemW);
                    if (clickedSlot >= 0 && clickedSlot < 4) {
                        this._slotsWindow.select(clickedSlot);
                        this._slotsWindow.setSelectedSlot(clickedSlot);
                        this._gridWindow.activate();
                        this.updateHelpText();
                        return;
                    }
                }
            }
        }
    };

    Scene_TOSParty.prototype.openCategoryMenu = function() {
        this._gridWindow.deactivate();
        this._slotsWindow.deactivate();
        this._categoryMenu.refresh();
        this._categoryMenu.show();
        this._categoryMenu.activate();
        this._categoryMenu.select(0);
    };

    Scene_TOSParty.prototype.closeCategoryMenu = function() {
        this._categoryMenu.hide();
        this._categoryMenu.deactivate();
        this._gridWindow.activate();
    };

    Scene_TOSParty.prototype.onCategorySelect = function(key) {
        $gameParty.setTosCategoryKey(key);
        this._categoryBar.refresh();
        this._gridWindow.refresh();
        this.closeCategoryMenu();
        this.updateHelpText();
    };

    Scene_TOSParty.prototype.updateHelpText = function() {
        var slot = this._slotsWindow.selectedSlot();
        var roleText = (slot === 0) ? '隊長位' : ('隊員第 ' + (slot + 1) + ' 格');
        var shownCount = this._gridWindow ? this._gridWindow.maxItems() : 0;
        var catKey = $gameParty.tosCategoryKey();
        var catObj = CATEGORY_MODES.find(function(m) { return m.key === catKey; }) || CATEGORY_MODES[0];
        this._helpWindow.setText(
            '目標：【' + roleText + '】（上限 4 人）｜類別：' + catObj.label + '（顯示 ' + shownCount + ' 位）'
        );
    };

    Scene_TOSParty.prototype.onGridOk = function() {
        $gameParty.cleanupExcludedActors();
        var targetActorId = this._gridWindow.currentActorId();
        var targetSlot = this._slotsWindow.selectedSlot();
        if (!targetActorId || isInvalidOrExcludedActor(targetActorId)) {
            this._gridWindow.refresh();
            this._gridWindow.activate();
            return;
        }

        var members = $gameParty.members()
            .map(function(a) { return a.actorId(); })
            .filter(function(id) { return !isInvalidOrExcludedActor(id); })
            .slice(0, 4);

        var existingIndex = members.indexOf(targetActorId);

        if (existingIndex !== -1) {
            if (targetSlot < members.length) {
                var temp = members[targetSlot];
                members[targetSlot] = members[existingIndex];
                members[existingIndex] = temp;
            }
        } else {
            if (targetSlot < members.length) {
                members[targetSlot] = targetActorId;
            } else if (members.length < 4) {
                members.push(targetActorId);
            } else {
                members[members.length - 1] = targetActorId;
            }
        }

        members = members.slice(0, 4);

        if (members.length > 0) {
            while ($gameParty.members().length > 0) {
                $gameParty.removeActor($gameParty.members()[0].actorId());
            }
            members.forEach(function(id) {
                if (!isInvalidOrExcludedActor(id)) {
                    $gameParty.addActor(id);
                }
            });
        }

        this._slotsWindow.refresh();
        this._gridWindow.refresh();
        this.updateHelpText();
        this._gridWindow.activate();
    };

    Scene_TOSParty.prototype.onSlotOk = function() {
        this._slotsWindow.setSelectedSlot(this._slotsWindow.index());
        this._slotsWindow.deactivate();
        this._gridWindow.activate();
        this.updateHelpText();
    };

    // ------------------------------------------------------------------------
    // 6. 掛載到主選單「隊形」與外掛指令
    // ------------------------------------------------------------------------
    if (hookFormation) {
        Scene_Menu.prototype.commandFormation = function() {
            SceneManager.push(Scene_TOSParty);
        };
    }

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'OpenTOSParty') {
            SceneManager.push(Scene_TOSParty);
        } else if (command === 'UnlockTOSActor') {
            var id = Number(args[0]);
            if (id > 0) $gameParty.unlockTosActor(id);
        } else if (command === 'LockTOSActor') {
            var id = Number(args[0]);
            if (id > 0) $gameParty.lockTosActor(id);
        }
    };
})();