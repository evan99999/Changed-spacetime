/*:
 * @target MZ MV
 * @plugindesc 裝備煉化與完整技能動畫施放系統
 * @author ChatGPT
 *
 * @param 預設煉化金幣
 * @type number
 * @min 0
 * @default 1000
 *
 * @help
 * AlchemyRefine.js
 * 在地圖事件中呼叫腳本：
 * AlchemyManager.refineAndGrantCustomSkill();
 */

(function() {
    var parameters = PluginManager.parameters('AlchemyRefine');
    var paramCost = Number(parameters['預設煉化金幣'] || 1000);

    function isEquip(item) {
        return DataManager.isWeapon(item) || DataManager.isArmor(item);
    }

    function ensureAlchemyData(item) {
        if (!item) return null;
        if (!item._alchemyData) {
            item._alchemyData = { alchemySkillId: 0, originalName: null };
        }
        return item._alchemyData;
    }

    function parseAlchemyPool(item) {
        if (!item || !item.note) return [];
        var pool = [];
        var match = item.note.match(/<AlchemyPool>([\s\S]*?)<\/AlchemyPool>/i);
        if (match) {
            var lines = match[1].trim().split('\n');
            lines.forEach(function(line) {
                var parts = {};
                line.split(',').forEach(function(segment) {
                    var kv = segment.split(':');
                    if (kv.length === 2) {
                        var key = kv[0].trim();
                        var val = Number(kv[1].trim());
                        parts[key] = val;
                    }
                });
                if (parts.skillId !== undefined) {
                    pool.push({
                        skillId: parts.skillId,
                        rate: parts.rate || 10
                    });
                }
            });
        }
        return pool;
    }

    function executeAlchemy(item) {
        var data = ensureAlchemyData(item);
        var pool = parseAlchemyPool(item);
        if (pool.length === 0) return null;

        var totalRate = 0;
        pool.forEach(function(p) { totalRate += p.rate; });

        var roll = Math.random() * totalRate;
        var current = 0;
        var selected = null;

        for (var i = 0; i < pool.length; i++) {
            current += pool[i].rate;
            if (roll <= current) {
                selected = pool[i];
                break;
            }
        }

        if (selected && $dataSkills[selected.skillId]) {
            data.alchemySkillId = selected.skillId;
            if (!data.originalName) {
                data.originalName = item.name;
            }
            var skillName = $dataSkills[selected.skillId].name;
            item.name = data.originalName + " [" + skillName + "]";
            return skillName;
        }
        return null;
    }

    // 透過 BattleManager 的動作佇列來施放技能，這樣就會完整播放動畫與特效
    var _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        _Game_Action_apply.call(this, target);

        if (this.subject().isActor() && this.isAttack()) {
            var actor = this.subject();
            var weapons = actor.weapons();

            for (var i = 0; i < weapons.length; i++) {
                var weapon = weapons[i];
                if (weapon && weapon._alchemyData && weapon._alchemyData.alchemySkillId) {
                    var skillId = weapon._alchemyData.alchemySkillId;
                    var skill = $dataSkills[skillId];

                    if (skill) {
                        var action = new Game_Action(actor);
                        action.setSkill(skillId);
                        if (action.testApply(target)) {
                            if (BattleManager._logWindow) {
                                BattleManager._logWindow.addText(actor.name() + " 的裝備自動發動了 " + skill.name + "！");
                            }
                            // 將技能動作加入戰鬥執行序列，這會自動帶出該技能的動畫與判定
                            BattleManager.queueExtraAction(actor, action, target);
                        }
                    }
                }
            }
        }
    };

    // 擴充 BattleManager 來支援額外動態插入的追擊技能與動畫
    if (BattleManager.queueExtraAction === undefined) {
        BattleManager.queueExtraAction = function(subject, action, target) {
            if (!this._extraActionQueue) {
                this._extraActionQueue = [];
            }
            this._extraActionQueue.push({ subject: subject, action: action, target: target });
        };

        var _BattleManager_update = BattleManager.update;
        BattleManager.update = function() {
            _BattleManager_update.call(this);
            if (!this.isBusy() && this._extraActionQueue && this._extraActionQueue.length > 0) {
                var data = this._extraActionQueue.shift();
                var action = data.action;
                var target = data.target;
                
                this._subject = data.subject;
                action.apply(target);
                target.startDamagePopup();
                if (target.result().hpAffected) {
                    target.performDamage();
                }
            }
        };
    }

    window.AlchemyManager = {
        refineAndGrantCustomSkill: function() {
            var actor = $gameParty.leader();
            if (!actor) {
                $gameMessage.add("隊伍中沒有角色！");
                return;
            }

            var targetItem = actor.weapons()[0] || actor.armors()[0];
            
            if (!targetItem || parseAlchemyPool(targetItem).length === 0) {
                var items = $gameParty.weapons().concat($gameParty.armors());
                for (var i = 0; i < items.length; i++) {
                    if (parseAlchemyPool(items[i]).length > 0) {
                        targetItem = items[i];
                        break;
                    }
                }
            }

            if (!targetItem || parseAlchemyPool(targetItem).length === 0) {
                SoundManager.playBuzzer();
                $gameMessage.add("此裝備未設定煉化技能範圍！");
                return;
            }

            if ($gameParty.gold() >= paramCost) {
                $gameParty.loseGold(paramCost);
                var skillName = executeAlchemy(targetItem);
                if (skillName) {
                    SoundManager.playShop();
                    $gameMessage.add("煉化成功！裝備獲得了攻擊自動觸發技能：【" + skillName + "】！");
                } else {
                    $gameMessage.add("煉化失敗，未能在設定範圍中抽出技能。");
                }
            } else {
                SoundManager.playBuzzer();
                $gameMessage.add("金幣不足，無法煉化！");
            }
        }
    };

})();