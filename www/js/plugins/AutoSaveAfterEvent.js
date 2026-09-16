/*:
 * @plugindesc 自動存檔插件 - 自動保存目前正在遊玩的存檔槽
 * @author ChatGPT
 *
 * @help
 * ============================================================
 * AutoSaveCurrentSlot.js
 * RPG Maker MV
 * ============================================================
 *
 * 功能：
 *
 * 自動存檔時，不會固定存到存檔1。
 * 而是自動保存「玩家目前正在遊玩的存檔槽」。
 *
 * 例如：
 *
 * 玩家讀取 存檔2
 *     ↓
 * 遊戲中取得隨機道具
 *     ↓
 * 插件指令：AutoSave
 *     ↓
 * 自動保存到 存檔2
 *
 * 玩家讀取 存檔5
 *     ↓
 * 插件指令：AutoSave
 *     ↓
 * 自動保存到 存檔5
 *
 * ============================================================
 *
 * 【插件指令】
 *
 * AutoSave
 *
 * 立即保存目前遊玩的存檔槽。
 *
 * AutoSaveAfterItem
 *
 * 取得道具後使用，保存目前遊玩的存檔槽。
 *
 * ============================================================
 *
 * 【寶箱範例】
 *
 * ◆增加物品：傳說之劍 + 1
 * ◆顯示文字：獲得了「傳說之劍」！
 * ◆插件指令：AutoSave
 * ◆獨立開關 A = ON
 *
 * ============================================================
 */

(function() {

    'use strict';


    //==========================================================
    // 插件指令
    //==========================================================

    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;

    Game_Interpreter.prototype.pluginCommand = function(command, args) {

        _Game_Interpreter_pluginCommand.call(this, command, args);

        if (command === 'AutoSave') {
            AutoSaveCurrentSlot.save();
        }

        if (command === 'AutoSaveAfterItem') {
            AutoSaveCurrentSlot.save();
        }

    };


    //==========================================================
    // 自動存檔系統
    //==========================================================

    var AutoSaveCurrentSlot = {};


    AutoSaveCurrentSlot.save = function() {

        // 戰鬥中不存檔
        if ($gameParty && $gameParty.inBattle()) {
            return;
        }


        //======================================================
        // 取得目前正在使用的存檔槽
        //======================================================

        var savefileId = DataManager._lastAccessedId;


        // 如果沒有記錄目前存檔槽
        // 預設使用1號存檔
        if (!savefileId || savefileId < 1) {
            savefileId = 1;
        }


        //======================================================
        // 保存到目前存檔槽
        //======================================================

        DataManager.saveGame(savefileId);


        console.log(
            'AutoSave：已自動保存到存檔 ' +
            savefileId
        );

    };


})();