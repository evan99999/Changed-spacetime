/*:
 * @plugindesc 敵人最大HP上限100000000
 * @author ChatGPT
 *
 * @help
 * ============================================================
 * EnemyHp100Million.js
 * RPG Maker MV
 * ============================================================
 *
 * 使用方法：
 *
 * 在敵人的「備註」欄輸入：
 *
 * <MaxHP:100000000>
 *
 * 該敵人的最大HP就會變成：
 *
 * 100,000,000
 *
 * ============================================================
 *
 * 也可以設定不同敵人的HP：
 *
 * <MaxHP:5000000>
 *
 * <MaxHP:20000000>
 *
 * <MaxHP:100000000>
 *
 * ============================================================
 *
 * 最大限制：
 *
 * 100,000,000
 *
 * ============================================================
 */

(function() {

    'use strict';


    //==========================================================
    // 最大HP限制
    //==========================================================

    var MAX_HP_LIMIT = 100000000;


    //==========================================================
    // 讀取敵人備註
    //==========================================================

    Game_Enemy.prototype.customMaxHp =
        function() {

        var enemy = this.enemy();

        if (!enemy || !enemy.note) {
            return null;
        }

        var note = enemy.note;

        // <MaxHP:100000000>
        var match = note.match(
            /<MaxHP\s*:\s*(\d+)\s*>/i
        );

        if (!match) {
            return null;
        }

        var value = Number(match[1]);

        if (!isFinite(value)) {
            return null;
        }

        value = Math.floor(value);

        value = Math.max(
            1,
            value
        );

        value = Math.min(
            MAX_HP_LIMIT,
            value
        );

        return value;

    };


    //==========================================================
    // 修改敵人基本參數
    //==========================================================

    var _Game_Enemy_paramBase =
        Game_Enemy.prototype.paramBase;

    Game_Enemy.prototype.paramBase =
        function(paramId) {

        var value =
            _Game_Enemy_paramBase.call(
                this,
                paramId
            );


        //======================================================
        // paramId 0 = 最大HP
        //======================================================

        if (paramId === 0) {

            var customHp =
                this.customMaxHp();

            if (customHp !== null) {

                value = customHp;

            }

        }


        //======================================================
        // 最大HP保護
        //======================================================

        if (paramId === 0) {

            value = Math.max(
                1,
                value
            );

            value = Math.min(
                MAX_HP_LIMIT,
                value
            );

        }

        return value;

    };


    //==========================================================
    // HP保護
    //==========================================================

    var _Game_BattlerBase_setHp =
        Game_BattlerBase.prototype.setHp;

    Game_BattlerBase.prototype.setHp =
        function(hp) {

        if (this.isEnemy()) {

            hp = Math.max(
                0,
                Math.min(
                    MAX_HP_LIMIT,
                    hp
                )
            );

        }

        _Game_BattlerBase_setHp.call(
            this,
            hp
        );

    };


    //==========================================================
    // 敵人初始化時重新確認HP
    //==========================================================

    var _Game_Enemy_setup =
        Game_Enemy.prototype.setup;

    Game_Enemy.prototype.setup =
        function(enemyId, x, y) {

        _Game_Enemy_setup.call(
            this,
            enemyId,
            x,
            y
        );

        var maxHp =
            this.customMaxHp();

        if (maxHp !== null) {

            this._hp = maxHp;

        }

    };


})();