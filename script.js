on("ready", function() {
    on("chat:message", msg => {
        if(msg.type == 'api' && msg.content.indexOf('!randpop') == 0 && playerIsGM(msg.playerid)) {
            let line = msg.content.split(' ');
            if(line.length == 1) {
                randPop.showHelp();
                return;
            }
            
            let token = msg.selected != undefined ? getObj("graphic", msg.selected[0]._id) || null : null;
            let count = parseInt(line[1]) || 0;
            let areaX = parseInt(line[2]) || 0;
            let areaY = parseInt(line[3]) || 0;
            
            let formulae = []
            if (line.length > 4) {
                for(let i = 4; i < line.length; i++) {
                    let parts = line[i].split('|');
                    if (parts.length == 2 && ((parts[0] == 'bar1') || parts[0] == 'bar2' || parts[0] == 'bar3')) {
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
    log("(>^-^)> Random Population started! <(^-^<)");
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
        sendChat("Random Population", `/w gm ${message}`, null, {noarchive: true});
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
            return (`&${entities[c]};`);
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
    
    function cloneTokenToPosition(token, left, top) {
        const regex = /(original|max|med)\./g;
        let imgsrc = token.get("imgsrc").replace(regex, "thumb.");
        if (imgsrc.indexOf('?') == -1) {
            imgsrc += '?'
        }
        
        let props = [
            "name", "controlledby", "represents", "width", "height", "rotation",
            "_pageid", "statusmarkers", "layer", "gmnotes", "tint_color", "showname",
            "light_radius", "light_dimradius", "light_otherplayers", "light_hassight",
            "light_angle", "light_losangle", "light_multiplier", "has_bright_light_vision",
            "has_night_vision", "night_vision_distance", "emits_bright_light", "bright_light_distance",
            "emits_low_light", "low_light_distance", "compact_bar", "playersedit_name",
            "tooltip", "show_tooltip", "flipv", "fliph", "bar_location", "sides", "currentSide"
        ];
        
        for (var i = 1; i < 4; i++) {
            props.push(`bar${i}_value`);
            props.push(`bar${i}_max`);
            props.push(`bar${i}_link`);
            props.push(`showplayers_bar${i}`);
            props.push(`playersedit_bar${i}`);
            if (i < 3) {
                props.push(`aura${i}_radius`);
                props.push(`aura${i}_color`);
                props.push(`aura${i}_square`);
                props.push(`showplayers_aura${i}`);
                props.push(`playersedit_aura${i}`);
            }
        }
        
        let newToken = {
            top: top,
            left: left,
            imgsrc: imgsrc
        }
        
        props.forEach(prop => {
            newToken[prop] = token.get(prop);
        });
        
        return createObj("graphic", newToken);
    }
    
    function duplicateToken(token, count, xShift, yShift, formulae) {
        if(token === null || token === undefined) {
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
        
        const tokenSize = Math.max(token.get("width"), token.get("height"));
        
        let available = []
        for(let x = -xShift; x <= xShift; x++) {
            for(let y = -yShift; y <= yShift; y++) {
                if(x == 0 && y == 0)
                    continue;
                available.push({x: x, y: y});
            }
        }
    
        for(let i = 0; i < count; i++) {
            let index = randomInteger(available.length) - 1;
            let pos = available[index];
            let left = token.get("left") + unitsToPixels(pos.x) * pixelsToUnits(tokenSize);
            let top = token.get("top") + unitsToPixels(pos.y) * pixelsToUnits(tokenSize);
            available.splice(index, 1);
            let newToken = cloneTokenToPosition(token, left, top);
            if (newToken === undefined || newToken === null) {
                log(`<(O_o)> Randpop failed to cloneTokenToPosition(${token}, ${left}, ${top})`);
            } else {
                newToken.set("name", newToken.get("name") + ` ${i + 1}`);
                for(let j = 0; j < formulae.length; j++) {
                    let parts = formulae[j].split('|');
                    sendChat('', `/r ${parts[1]}`, ops => {
                        let hp = JSON.parse(ops[0].content).total;
                        newToken.set(`${parts[0]}_value`, hp);
                        newToken.set(`${parts[0]}_max`, hp);
                    }, {noarchive: true});
                }    
            }
        }
    }
    
    return {
        duplicateToken: duplicateToken,
        esc: ch,
        respond: respond,
        showHelp: showHelp
    };

}());
