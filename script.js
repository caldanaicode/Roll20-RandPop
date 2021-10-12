on("ready", function() {
    on("chat:message", msg => {
        if(msg.type == 'api' && msg.content.indexOf('!randpop') == 0 && playerIsGM(msg.playerid)) {
            var line = msg.content.split(' ');
            if(line.length == 1) {
                randPop.showHelp();
                return;
            }
            
            var token = msg.selected != undefined ? getObj("graphic", msg.selected[0]._id) || null : null;
            var count = parseInt(line[1]) || 0;
            var areaX = parseInt(line[2]) || 0;
            var areaY = parseInt(line[3]) || 0;
            
            var formulae = []
            if (line.length > 4) {
                for(var i = 4; i < line.length; i++) {
                    var parts = line[i].split('|');
                    if (parts.length == 2 && ((parts[0] == 'bar1') || parts[0] == 'bar2' ||parts[0] == 'bar3')) {
                        formulae.push(line[i]);
                    }
                    else {
                        randPop.respond("Invalid optional formula. You must specify bar1, bar2, or bar3, followed by a pipe '|' and a number or formula to use.");
                        return;
                    }
                }
            }
            
            randPop.duplicateToken(token, count, areaX, areaY, formulae);
        }
    });
});

var randPop = randPop || (function() {
    const PIX_PER_UNIT = 70;
    
    function unitsToPixels(units) {
    	return PIX_PER_UNIT * units;
    }
    
    function pixelsToUnits(pixels) {
        return pixels / PIX_PER_UNIT;
    }
    
    function respond(message) {
        sendChat("Random Population", "/w gm " + message, null, {noarchive: true});
    }
    
    function ch(c) {
        let entities = {
            '<' : 'lt',
            '>' : 'gt',
            "'" : '#39',
            '@' : '#64',
            '{' : '#123',
            '|' : '#124',
            '}' : '#125',
            '[' : '#91',
            ']' : '#93',
            '"' : 'quot',
            '*' : 'ast',
            '/' : 'sol',
            ' ' : 'nbsp'
        };
    
        if(c.length > 1) {
            return c.split('').map(x => ch(x)).join('');
        }
        else if(c in entities) {
            return ('&' + entities[c] + ';');
        }
        
        return '';
    }
    
    function showHelp() {
        respond(
            "<br><br>You must have a token selected, as well as specify the number of duplicates, and the extents " +
            "(horizontal and vertical) in token-units. You may also provide optional numbers to use as bar values " +
            `like bar1|10 or bar3|${randPop.esc('@{')}selected|npc_hpformula${randPop.esc('}')}.<br><br>Example: <br><br>` +
            `<b>!randpop 10 4 5 bar3|${randPop.esc('@{')}selected|npc_hpformula${randPop.esc('}')}</b><br><br>` +
            "Results in 10 duplicates in a space ±4 tokens horizontally, and ±5 tokens vertically, relative to the " +
            "selected token with the selected token's hp formula set as bar3's value."
        );
    }
    
    function duplicateToken(token, count, xShift, yShift, formulae) {
        if(token === null) {
            respond("No token selected.");
            return;
        }
        
        if(count <= 0) {
            respond("Count must be greater than 0");
            return;
        }
        
        xShift = Math.abs(xShift);
        yShift = Math.abs(yShift);
        
        
        if((xShift * 2 + 1) * (yShift * 2 + 1) < count + 1) {
            respond("There is not enough space for the number of duplicates.");
            return;
        }
        
        var tokenSize = Math.max(token.get("width"), token.get("height"));
        
        var available = []
        for(var x = -xShift; x <= xShift; x++) {
            for(var y = -yShift; y <= yShift; y++) {
                if(x == 0 && y == 0)
                    continue;
                available.push({x: x, y: y});
            }
        }
    
        for(var i = 0; i < count; i++) {
            let index = randomInteger(available.length) - 1;
            let pos = available[index];
            let left = token.get("left") + unitsToPixels(pos.x) * pixelsToUnits(tokenSize);
            let top = token.get("top") + unitsToPixels(pos.y) * pixelsToUnits(tokenSize);
            available.splice(index, 1);
            let newToken = cloneTokenToPosition(token, left, top);
            for(var j = 0; j < formulae.length; j++) {
                var parts = formulae[j].split('|');
                sendChat('', '/r ' + parts[1], ops => {
                    var hp = JSON.parse(ops[0].content).total;
                    newToken.set(parts[0] + "_value", hp);
                    newToken.set(parts[0] + "_max", hp);
                }, {noarchive: true});
            }
        }
    }
    
    function cloneTokenToPosition(token, left, top) {
        var imgsrc = token.get("imgsrc").replace("original", "thumb").replace("max", "thumb");
        if (imgsrc.indexOf('?') == -1) {
            imgsrc += '?'
        }
        
        var props = [ "name", "controlledby", "represents", "width", "height", "rotation",
            "_pageid", "statusmarkers", "layer", "gmnotes", "tint_color", "showname",
            "light_radius", "light_dimradius", "light_otherplayers", "light_hassight",
            "light_angle", "light_losangle", "light_multiplier", "has_bright_light_vision",
            "has_night_vision", "night_vision_distance", "emits_bright_light", "bright_light_distance",
            "emits_low_light", "low_light_distance", "compact_bar", "playersedit_name",
            "tooltip", "show_tooltip", "flipv", "fliph", "bar_location", "sides", "currentSide"
        ];
        
        for (var i = 1; i < 4; i++) {
            props.push("bar" + i + "_value");
            props.push("bar" + i + "_max");
            props.push("bar" + i + "_link");
            props.push("showplayers_bar" + i);
            props.push("playersedit_bar" + i);
            if (i < 3) {
                props.push("aura" + i + "_radius");
                props.push("aura" + i + "_color");
                props.push("aura" + i + "_square");
                props.push("showplayers_aura" + i);
                props.push("playersedit_aura" + i);
            }
        }
        
        var newToken = {
            top: top,
            left: left,
            imgsrc: imgsrc
        }
        
        for (var i = 0; i < props.length; i++) {
            newToken[props[i]] = token.get(props[i]);
        }
        
        return createObj("graphic",newToken);
    }
    
    return {
        duplicateToken: duplicateToken,
        esc: ch,
        respond: respond,
        showHelp: showHelp
    };

}());
