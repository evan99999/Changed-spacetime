/*:
 * @plugindesc 仿神魔之塔風格的卡片式隊伍編組介面 (清楚大字藍條 + 獨立改名 + 精準左右切換)
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
 * @desc 開啟背包時自動排除的角色 ID，以逗號分隔（預設 163）。空白/無名角色也會自動剔除。
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
 * 【使用說明 - 藍條操作】
 * 1. 隊伍切換：
 *    - 點擊「◀」：上一隊（10 -> 9 -> ... -> 1）
 *    - 點擊「▶」：下一隊（1 -> 2 -> ... -> 10）
 * 2. 編輯隊伍名稱：
 *    - 點擊藍色條右側的「✎ 改名」按鈕，即可開啟輸入視窗修改目前隊伍名稱。
 * 3. 空隊伍防呆：
 *    - 若目前隊伍成員為 0 人，無法返回主選單，需放入角色或切換至有成員的隊伍。
 * ----------------------------------------------------------------------------
 */

(function() {
    var parameters = PluginManager.parameters('TowerOfSaviorsParty');
    var maxCols = Number(parameters['MaxCols'] || 4);
    var cardSize = Number(parameters['CardSize'] || 84);
    var maxParty = 4;
    var totalParties = 10;
    var coopPartyIndex = 9; // 第 10 隊（索引 0~9 中的 9）

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
    // 擴充 Game_Party：10 組隊伍、隊伍名稱、已獲得角色、聯機狀態
    // ------------------------------------------------------------------------
    var _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.call(this);
        this.initTosData();
    };

    Game_Party.prototype.initTosData = function() {
        if (!this._tosOwnedActors) {
            this._tosOwnedActors = [];
        }
        if (!this._tosCategoryKey) {
            this._tosCategoryKey = 'obtain';
        }
        if (!this._tosCoopMode) {
            this._tosCoopMode = 'none';
        }
        if (typeof this._tosCurrentPartyIndex !== 'number') {
            this._tosCurrentPartyIndex = 0;
        }
        if (!Array.isArray(this._tosPartyNames) || this._tosPartyNames.length !== totalParties) {
            this._tosPartyNames = [];
            for (var i = 0; i < totalParties; i++) {
                this._tosPartyNames.push(i === coopPartyIndex ? '聯機模式隊伍' : ('隊伍 ' + (i + 1)));
            }
        }
        if (!Array.isArray(this._tosParties) || this._tosParties.length !== totalParties) {
            this._tosParties = [];
            var initialMembers = (this._actors || []).filter(function(id) {
                return !isInvalidOrExcludedActor(id);
            }).slice(0, maxParty);
            for (var j = 0; j < totalParties; j++) {
                this._tosParties.push(j === 0 ? initialMembers.slice() : []);
            }
        }
    };

    Game_Party.prototype.tosCoopMode = function() {
        this.initTosData();
        return this._tosCoopMode;
    };

    Game_Party.prototype.setTosCoopMode = function(mode) {
        this.initTosData();
        if (mode !== 'none' && mode !== 'host' && mode !== 'guest') return;
        this._tosCoopMode = mode;
        if (mode === 'guest') {
            this.switchTosParty(coopPartyIndex, true);
        }
    };

    Game_Party.prototype.tosCurrentPartyIndex = function() {
        this.initTosData();
        if (this._tosCoopMode === 'guest') {
            this._tosCurrentPartyIndex = coopPartyIndex;
        }
        return this._tosCurrentPartyIndex;
    };

    Game_Party.prototype.tosPartyName = function(index) {
        this.initTosData();
        var idx = (typeof index === 'number') ? index : this.tosCurrentPartyIndex();
        return this._tosPartyNames[idx] || (idx === coopPartyIndex ? '聯機模式隊伍' : ('隊伍 ' + (idx + 1)));
    };

    Game_Party.prototype.setTosPartyName = function(index, name) {
        this.initTosData();
        if (index < 0 || index >= totalParties) return;
        var trimmed = String(name || '').trim();
        if (trimmed) {
            this._tosPartyNames[index] = trimmed;
        }
    };

    Game_Party.prototype.tosPartyMembers = function(index) {
        this.initTosData();
        var idx = (typeof index === 'number') ? index : this.tosCurrentPartyIndex();
        return (this._tosParties[idx] || []).slice(0, maxParty);
    };

    Game_Party.prototype.setTosPartyMembers = function(index, actorIds) {
        this.initTosData();
        if (index < 0 || index >= totalParties) return;
        var cleaned = (actorIds || []).filter(function(id) {
            return !isInvalidOrExcludedActor(id);
        }).slice(0, maxParty);
        this._tosParties[index] = cleaned;
        if (index === this.tosCurrentPartyIndex()) {
            this.syncActivePartyToGameParty();
        }
    };

    Game_Party.prototype.syncActivePartyToGameParty = function() {
        this.initTosData();
        var activeIds = this.tosPartyMembers(this.tosCurrentPartyIndex());
        while (this._actors.length > 0) {
            this._actors.pop();
        }
        activeIds.forEach(function(id) {
            if (!isInvalidOrExcludedActor(id) && this._actors.indexOf(id) === -1) {
                this._actors.push(id);
            }
        }, this);
    };

    Game_Party.prototype.switchTosParty = function(targetIndex, force) {
        this.initTosData();
        if (targetIndex < 0 || targetIndex >= totalParties) return false;
        if (this._tosCoopMode === 'guest' && targetIndex !== coopPartyIndex && !force) {
            return false;
        }
        this._tosCurrentPartyIndex = targetIndex;
        this.syncActivePartyToGameParty();
        return true;
    };

    Game_Party.prototype.canGuestJoinHostParty = function() {
        this.initTosData();
        var coopMembers = this.tosPartyMembers(coopPartyIndex);
        return coopMembers.length === 1;
    };

    Game_Party.prototype.canHostAcceptPlayer = function() {
        this.initTosData();
        if (this._tosCoopMode !== 'host') return false;
        if (this.tosCurrentPartyIndex() !== coopPartyIndex) return false;
        return this.tosPartyMembers(coopPartyIndex).length < maxParty;
    };

    Game_Party.prototype.addCoopActorToParty10 = function(actorId) {
        this.initTosData();
        if (this._tosCoopMode !== 'host') {
            return { ok: false, reason: '目前非房主模式' };
        }
        if (this.tosCurrentPartyIndex() !== coopPartyIndex) {
            return { ok: false, reason: '房主必須先將隊伍切換成第 10 隊（聯機模式隊伍）才能讓玩家加入' };
        }
        var coopMembers = this.tosPartyMembers(coopPartyIndex);
        if (coopMembers.length >= maxParty) {
            return { ok: false, reason: '第 10 隊已滿（4 人），請先空出位置' };
        }
        if (isInvalidOrExcludedActor(actorId)) {
            return { ok: false, reason: '無效或已剔除的角色 ID' };
        }
        if (coopMembers.indexOf(actorId) === -1) {
            coopMembers.push(actorId);
            this.setTosPartyMembers(coopPartyIndex, coopMembers);
        }
        return { ok: true, reason: '已將玩家角色加入第 10 隊' };
    };

    Game_Party.prototype.clearTosParty10 = function() {
        this.initTosData();
        this.setTosPartyMembers(coopPartyIndex, []);
    };

    Game_Party.prototype.tosCategoryKey = function() {
        this.initTosData();
        return this._tosCategoryKey || 'obtain';
    };

    Game_Party.prototype.setTosCategoryKey = function(key) {
        this.initTosData();
        this._tosCategoryKey = key;
    };

    Game_Party.prototype.cleanupExcludedActors = function() {
        this.initTosData();

        var cleanedOwned = [];
        this._tosOwnedActors.forEach(function(id) {
            if (!isInvalidOrExcludedActor(id) && cleanedOwned.indexOf(id) === -1) {
                cleanedOwned.push(id);
            }
        });

        for (var p = 0; p < totalParties; p++) {
            var filteredParty = (this._tosParties[p] || []).filter(function(id) {
                return !isInvalidOrExcludedActor(id);
            }).slice(0, maxParty);
            this._tosParties[p] = filteredParty;

            filteredParty.forEach(function(actorId) {
                if (cleanedOwned.indexOf(actorId) === -1) {
                    cleanedOwned.push(actorId);
                }
            });
        }

        this._actors.forEach(function(actorId) {
            if (!isInvalidOrExcludedActor(actorId) && cleanedOwned.indexOf(actorId) === -1) {
                cleanedOwned.push(actorId);
            }
        });

        this._tosOwnedActors = cleanedOwned;

        if (this._tosCoopMode === 'guest') {
            this._tosCurrentPartyIndex = coopPartyIndex;
        }
        this.syncActivePartyToGameParty();
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
        for (var p = 0; p < totalParties; p++) {
            this._tosParties[p] = (this._tosParties[p] || []).filter(function(id) {
                return id !== actorId;
            });
        }
        this.syncActivePartyToGameParty();
    };

    var _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function(actorId) {
        if (isInvalidOrExcludedActor(actorId)) return;
        this.unlockTosActor(actorId);
        var curIdx = this.tosCurrentPartyIndex();
        var list = this.tosPartyMembers(curIdx);
        if (list.indexOf(actorId) === -1 && list.length < maxParty) {
            list.push(actorId);
            this.setTosPartyMembers(curIdx, list);
        }
        _Game_Party_addActor.call(this, actorId);
        while (this._actors.length > maxParty) {
            this._actors.pop();
        }
    };

    // ------------------------------------------------------------------------
    // 1. 藍色條狀區左側：10 隊伍切換與改名條（清楚大字 + 獨立按鈕區域）
    // ------------------------------------------------------------------------
    function Window_TOSPartySwitchBar() {
        this.initialize.apply(this, arguments);
    }

    Window_TOSPartySwitchBar.prototype = Object.create(Window_Base.prototype);
    Window_TOSPartySwitchBar.prototype.constructor = Window_TOSPartySwitchBar;

    Window_TOSPartySwitchBar.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._hitAreas = { prev: null, next: null, rename: null };
        this.refresh();
    };

    Window_TOSPartySwitchBar.prototype.standardPadding = function() {
        return 8;
    };

    Window_TOSPartySwitchBar.prototype.refresh = function() {
        this.contents.clear();
        var idx = $gameParty.tosCurrentPartyIndex();
        var pName = $gameParty.tosPartyName(idx);
        var mode = $gameParty.tosCoopMode();

        var w = this.contentsWidth();
        var h = this.contentsHeight();

        // 藍底背景
        this.contents.fillRect(0, 0, w, h, 'rgba(28, 82, 165, 0.95)');

        // 計算各按鈕在「視窗內容區」的 X 座標，並換算為「全畫面座標」供點擊偵測
        var btnH = Math.max(28, h - 8);
        var btnY = Math.floor((h - btnH) / 2);
        var prevW = 36;
        var nextW = 36;
        var renameW = 74;
        var gap = 4;

        var prevX = 4;
        var nextX = prevX + prevW + gap;
        var renameX = w - renameW - 4;
        var nameX = nextX + nextW + gap;
        var nameW = Math.max(40, renameX - nameX - gap);

        // 繪製 [◀]
        this.contents.fillRect(prevX, btnY, prevW, btnH, 'rgba(15, 45, 95, 0.9)');
        this.contents.fontSize = 18;
        this.changeTextColor('#ffffff');
        this.drawText('◀', prevX, btnY + Math.floor((btnH - 24) / 2), prevW, 'center');

        // 繪製 [▶]
        this.contents.fillRect(nextX, btnY, nextW, btnH, 'rgba(15, 45, 95, 0.9)');
        this.drawText('▶', nextX, btnY + Math.floor((btnH - 24) / 2), nextW, 'center');

        // 繪製隊伍編號與名稱
        var modeTag = mode === 'guest' ? ' [鎖10]' : (mode === 'host' && idx === coopPartyIndex ? ' [聯機]' : '');
        var titleText = (idx + 1) + '/' + totalParties + ' ' + pName + modeTag;
        this.contents.fontSize = 18;
        this.changeTextColor('#ffffff');
        this.drawText(titleText, nameX, btnY + Math.floor((btnH - 24) / 2), nameW, 'left');

        // 繪製 [✎ 改名] 按鈕
        this.contents.fillRect(renameX, btnY, renameW, btnH, 'rgba(240, 180, 20, 0.95)');
        this.contents.fontSize = 16;
        this.changeTextColor('#111111');
        this.drawText('✎ 改名', renameX, btnY + Math.floor((btnH - 24) / 2), renameW, 'center');

        var ox = this.x + this.padding;
        var oy = this.y + this.padding;
        this._hitAreas = {
            prev:   { x: ox + prevX,   y: oy + btnY, w: prevW,   h: btnH },
            next:   { x: ox + nextX,   y: oy + btnY, w: nextW,   h: btnH },
            rename: { x: ox + renameX, y: oy + btnY, w: renameW, h: btnH }
        };
    };

    Window_TOSPartySwitchBar.prototype.detectHitAction = function(gx, gy) {
        var hit = function(box) {
            return box && gx >= box.x && gx <= box.x + box.w && gy >= box.y && gy <= box.y + box.h;
        };
        if (hit(this._hitAreas.prev)) return 'prev';
        if (hit(this._hitAreas.next)) return 'next';
        if (hit(this._hitAreas.rename)) return 'rename';
        return null;
    };

    // ------------------------------------------------------------------------
    // 2. 類別切換列視窗（藍色條狀區右側）
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

    Window_TOSCategoryBar.prototype.standardPadding = function() {
        return 8;
    };

    Window_TOSCategoryBar.prototype.refresh = function() {
        this.contents.clear();
        var key = $gameParty.tosCategoryKey();
        var mode = CATEGORY_MODES.find(function(m) { return m.key === key; }) || CATEGORY_MODES[0];

        var w = this.contentsWidth();
        var h = this.contentsHeight();

        this.contents.fillRect(0, 0, w, h, 'rgba(45, 65, 105, 0.95)');
        this.contents.fontSize = 17;
        this.changeTextColor('#ffd700');
        this.drawText('▼ ' + mode.label, 4, Math.floor((h - 24) / 2), w - 8, 'center');
    };

    // ------------------------------------------------------------------------
    // 3. 類別選單視窗
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
    // 4. 上方：目前隊伍欄位視窗（固定 4 人）
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
        var partyMembers = $gameParty.tosPartyMembers($gameParty.tosCurrentPartyIndex());
        var actorId = partyMembers[index] || null;
        var actor = actorId ? $gameActors.actor(actorId) : null;

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
    // 5. 下方：已獲得角色卡片網格視窗
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
        var curParty = $gameParty.tosPartyMembers($gameParty.tosCurrentPartyIndex());
        var isInParty = curParty.indexOf(actorId) !== -1;

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
    // 6. 整合場景 Scene_TOSParty
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
        this.createBlueStripBars();
        this.createPartySlotsWindow();
        this.createActorGridWindow();
        this.createCategoryMenuWindow();
        this.updateHelpText();
    };

    Scene_TOSParty.prototype.tryExitScene = function() {
        var curIdx = $gameParty.tosCurrentPartyIndex();
        var currentMembers = $gameParty.tosPartyMembers(curIdx);

        if (!currentMembers || currentMembers.length === 0) {
            SoundManager.playBuzzer();
            var pName = $gameParty.tosPartyName(curIdx);
            this._helpWindow.setText(
                '\\C[18]【無法返回】第' + (curIdx + 1) + '隊（' + pName + '）沒有任何成員！請放入角色或切換至有成員的隊伍\\C[0]'
            );
            this._gridWindow.activate();
            return;
        }

        $gameParty.syncActivePartyToGameParty();
        this.popScene();
    };

    Scene_TOSParty.prototype.createBlueStripBars = function() {
        var wy = this._helpWindow.height;
        var wh = 64;
        var catW = Math.min(165, Math.floor(Graphics.boxWidth * 0.30));
        var partyW = Graphics.boxWidth - catW;

        this._partySwitchBar = new Window_TOSPartySwitchBar(0, wy, partyW, wh);
        this._categoryBar = new Window_TOSCategoryBar(partyW, wy, catW, wh);

        this.addWindow(this._partySwitchBar);
        this.addWindow(this._categoryBar);
    };

    Scene_TOSParty.prototype.createPartySlotsWindow = function() {
        var wy = this._partySwitchBar.y + this._partySwitchBar.height;
        var wh = 175;
        this._slotsWindow = new Window_TOSPartySlots(0, wy, Graphics.boxWidth, wh);
        this._slotsWindow.setHandler('ok', this.onSlotOk.bind(this));
        this._slotsWindow.setHandler('cancel', this.tryExitScene.bind(this));
        this._slotsWindow.deactivate();
        this.addWindow(this._slotsWindow);
    };

    Scene_TOSParty.prototype.createActorGridWindow = function() {
        var wy = this._slotsWindow.y + this._slotsWindow.height;
        var wh = Graphics.boxHeight - wy;
        this._gridWindow = new Window_TOSActorGrid(0, wy, Graphics.boxWidth, wh);
        this._gridWindow.setHandler('ok', this.onGridOk.bind(this));
        this._gridWindow.setHandler('cancel', this.tryExitScene.bind(this));
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

    Scene_TOSParty.prototype.renameCurrentParty = function() {
        var idx = $gameParty.tosCurrentPartyIndex();
        var oldName = $gameParty.tosPartyName(idx);
        var input = null;

        try {
            input = window.prompt('請輸入第 ' + (idx + 1) + ' 組隊伍名稱：', oldName);
        } catch (e) {
            input = null;
        }

        if (input !== null && String(input).trim() !== '') {
            $gameParty.setTosPartyName(idx, String(input).trim());
            SoundManager.playOk();
            this._partySwitchBar.refresh();
            this.updateHelpText();
        } else {
            // 若環境封鎖 prompt 或按取消，提示可用外掛指令或重試
            SoundManager.playBuzzer();
            this._helpWindow.setText('未變更隊伍名稱（若瀏覽器封鎖彈窗，可使用外掛指令 RenameTOSParty 編號 名稱）');
        }
        this._gridWindow.activate();
    };

    Scene_TOSParty.prototype.cycleParty = function(delta) {
        var mode = $gameParty.tosCoopMode();
        if (mode === 'guest') {
            SoundManager.playBuzzer();
            this._helpWindow.setText('\\C[18]聯機加入他人房間後，只能使用第 10 隊（聯機模式隊伍）！\\C[0]');
            return;
        }
        var cur = $gameParty.tosCurrentPartyIndex();
        // 順向 delta = +1：0 -> 1 -> 2 ... -> 9（顯示 1/10 -> 2/10 -> ... -> 10/10）
        // 逆向 delta = -1：9 -> 8 -> ... -> 0（顯示 10/10 -> 9/10 -> ... -> 1/10）
        var next = (cur + delta + totalParties) % totalParties;
        $gameParty.switchTosParty(next, false);
        SoundManager.playCursor();
        this._partySwitchBar.refresh();
        this._slotsWindow.refresh();
        this._gridWindow.refresh();
        this.updateHelpText();
    };

    Scene_TOSParty.prototype.clearSlotActor = function(slotIndex) {
        var pIdx = $gameParty.tosCurrentPartyIndex();
        var members = $gameParty.tosPartyMembers(pIdx).slice();
        if (slotIndex < 0 || slotIndex >= members.length) return;

        members.splice(slotIndex, 1);
        $gameParty.setTosPartyMembers(pIdx, members);
        SoundManager.playCancel();
        this._slotsWindow.refresh();
        this._gridWindow.refresh();
        this._partySwitchBar.refresh();
        this.updateHelpText();
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
                // 點擊藍色條狀區左側：精準判斷 ◀ / ▶ / ✎ 改名
                if (isPointInsideWindow(this._partySwitchBar, tx, ty)) {
                    var action = this._partySwitchBar.detectHitAction(tx, ty);
                    if (action === 'prev') {
                        this.cycleParty(-1);
                        return;
                    }
                    if (action === 'next') {
                        this.cycleParty(1);
                        return;
                    }
                    if (action === 'rename') {
                        this.renameCurrentParty();
                        return;
                    }
                    return;
                }

                // 點擊藍色條狀區右側：類別切換
                if (isPointInsideWindow(this._categoryBar, tx, ty)) {
                    this.openCategoryMenu();
                    return;
                }

                // 點擊上方 4 格隊伍位（再次點擊已選中的格位可清空該格角色）
                if (isPointInsideWindow(this._slotsWindow, tx, ty)) {
                    var localX = tx - this._slotsWindow.x - this._slotsWindow.padding;
                    var itemW = this._slotsWindow.itemWidth() + this._slotsWindow.spacing();
                    var clickedSlot = Math.floor(localX / itemW);
                    if (clickedSlot >= 0 && clickedSlot < 4) {
                        if (this._slotsWindow.selectedSlot() === clickedSlot) {
                            this.clearSlotActor(clickedSlot);
                        } else {
                            this._slotsWindow.select(clickedSlot);
                            this._slotsWindow.setSelectedSlot(clickedSlot);
                            this.updateHelpText();
                        }
                        this._gridWindow.activate();
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
        var pIdx = $gameParty.tosCurrentPartyIndex();
        var pName = $gameParty.tosPartyName(pIdx);
        var curMembersCount = $gameParty.tosPartyMembers(pIdx).length;
        var mode = $gameParty.tosCoopMode();
        var modeNote = '';

        if (curMembersCount === 0) {
            modeNote = '｜\\C[18]空隊伍（不可返回，請先選入角色或切換他隊）\\C[0]';
        } else if (mode === 'guest') {
            var count10 = $gameParty.tosPartyMembers(coopPartyIndex).length;
            modeNote = '｜房客(限第10隊:' + count10 + '人,' + (count10 === 1 ? '可入房主隊' : '需留1人') + ')';
        } else if (mode === 'host') {
            if (pIdx === coopPartyIndex) {
                var freeSlots = maxParty - $gameParty.tosPartyMembers(coopPartyIndex).length;
                modeNote = '｜房主(第10隊空位' + freeSlots + '格,可讓玩家加入)';
            } else {
                modeNote = '｜房主(請切換至第10隊才可讓玩家加入)';
            }
        }

        this._helpWindow.setText(
            '【第' + (pIdx + 1) + '隊:' + pName + '】目標:' + roleText + '｜顯示 ' + shownCount + ' 位' + modeNote
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

        var pIdx = $gameParty.tosCurrentPartyIndex();
        var members = $gameParty.tosPartyMembers(pIdx).slice(0, maxParty);
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
            } else if (members.length < maxParty) {
                members.push(targetActorId);
            } else {
                members[members.length - 1] = targetActorId;
            }
        }

        $gameParty.setTosPartyMembers(pIdx, members.slice(0, maxParty));
        this._slotsWindow.refresh();
        this._gridWindow.refresh();
        this._partySwitchBar.refresh();
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
    // 7. 掛載到主選單「隊形」與外掛指令
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
        } else if (command === 'SetTOSCoopMode') {
            var m = String(args[0] || 'none').toLowerCase();
            $gameParty.setTosCoopMode(m);
        } else if (command === 'RenameTOSParty') {
            var pNum = Number(args[0]);
            var newName = args.slice(1).join(' ');
            if (pNum >= 1 && pNum <= totalParties && newName) {
                $gameParty.setTosPartyName(pNum - 1, newName);
            }
        } else if (command === 'AddCoopActorTo10') {
            var actorId = Number(args[0]);
            $gameParty.addCoopActorToParty10(actorId);
        } else if (command === 'ClearTOSParty10') {
            $gameParty.clearTosParty10();
        } else if (command === 'UnlockTOSActor') {
            var id = Number(args[0]);
            if (id > 0) $gameParty.unlockTosActor(id);
        } else if (command === 'LockTOSActor') {
            var id = Number(args[0]);
            if (id > 0) $gameParty.lockTosActor(id);
        }
    };
})();