/*:
 * @plugindesc 吸血插件 - 攻擊造成傷害後依比例恢復HP
 * @author ChatGPT
 *
 * @help
 * ============================================================
 * VampireDrain.js
 * RPG Maker MV
 * ============================================================
 *
 * 【使用方法】
 *
 * 在武器、裝備或狀態的「備註」欄輸入：
 *
 * <吸血:10>
 *
 * 代表吸取造成傷害的 10% HP。
 *
 * ============================================================
 *
 * 例如：
 *
 * 玩家造成 50000 傷害
 *
 * <吸血:10>
 *
 * 玩家恢復：
 *
 * 50000 × 10% = 5000 HP
 *
 * ============================================================
 *
 * 也可以使用：
 *
 * <吸血:5>
 * <吸血:20>
 * <吸血:50>
 *
 * ============================================================
 *
 * 插件會自動判斷：
 *
 * 1. 攻擊者是否有吸血
 * 2. 實際造成多少傷害
 * 3. 按百分比計算吸血量
 * 4. 不會超過最大HP
 *
 * ============================================================
 */

(function() {

    'use strict';


    //=========================================================
    // 取得吸血比例
    //=========================================================

    Game_BattlerBase.prototype.vampireDrainRate = function() {

        var rate = 0;

        var objects = [];

        // 裝備
        if (this.isActor()) {
            objects = objects.concat(this.equips());
        }

        // 狀態
        objects = objects.concat(this.states());

        for (var i = 0; i < objects.length; i++) {

            var obj = objects[i];

            if (!obj) {
                continue;
            }

            var meta = obj.meta;

            if (!meta) {
                continue;
            }

            if (meta['吸血'] !== undefined) {

                var value = Number(meta['吸血']);

                if (!isNaN(value)) {
                    rate += value;
                }
            }
        }

        return rate;
    };


    //=========================================================
    // 記錄本次造成的傷害
    //=========================================================

    var _Game_Action_executeHpDamage =
        Game_Action.prototype.executeHpDamage;

    Game_Action.prototype.executeHpDamage = function(target, value) {

        _Game_Action_executeHpDamage.call(this, target, value);

        var subject = this.subject();

        if (!subject) {
            return;
        }

        // 必須是敵人或角色受到HP傷害
        if (value <= 0) {
            return;
        }

        // 必須確實造成傷害
        if (!target.result().hpDamage) {
            return;
        }

        var damage = target.result().hpDamage;

        if (damage <= 0) {
            return;
        }

        // 取得吸血比例
        var rate = subject.vampireDrainRate();

        if (rate <= 0) {
            return;
        }

        // 計算吸血量
        var drain = Math.floor(damage * rate / 100);

        if (drain <= 0) {
            return;
        }

        // 恢復HP
        var oldHp = subject.hp;

        subject.gainHp(drain);

        // 不超過最大HP
        if (subject.hp > subject.mhp) {
            subject.setHp(subject.mhp);
        }

        var actualDrain = subject.hp - oldHp;

        // 顯示吸血數字
        if (actualDrain > 0) {

            if (subject.isActor()) {

                var scene = SceneManager._scene;

                if (scene && scene._logWindow) {

                    scene._logWindow.push(
                        'addText',
                        subject.name() +
                        ' 吸取了 ' +
                        actualDrain +
                        ' 點HP！'
                    );
                }
            }
        }

    };

})();