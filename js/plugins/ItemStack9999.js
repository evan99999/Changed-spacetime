/*:
 * @plugindesc 物品堆疊上限9999
 * @author ChatGPT
 *
 * @help
 * 將所有物品、武器、防具的最大持有數量提高到9999。
 */

(function() {

    'use strict';

    Game_Party.prototype.maxItems = function(item) {
        return 9999;
    };

})();