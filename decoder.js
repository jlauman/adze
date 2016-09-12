


pattern = {
    "@type": "Contact",
    "firstName": "", 
    "lastName": "", 
    "phone": {
        "@type": "PhoneNumber",
        "name": "",
        "id": 1.1, 
        "completed": true, 
        "what": [1],
        "other@maybe": 1
    }
}

let genModel = (obj) => {
    let genModelObj = (obj, tacc, dacc) => {
        if (!obj['@type']) throw new Error("missing @type");
        let type = obj['@type'];
        let tdec = type.charAt(0).toLowerCase() + type.substring(1);
        let keys = Object.getOwnPropertyNames(obj).filter(key => !key.startsWith('@'));
        let objects = [];
        tacc.push(`type alias ${type} =`);
        dacc.push(`${tdec}Decoder : Decoder ${type}`);
        dacc.push(`${tdec}Decoder =`);
        dacc.push(`  object${keys.length} ${type}`);
        let first = true;
        let separator = () => (first ? '{' : ',');
        keys.forEach((key) => {
            let val = obj[key];
            let maybe1 = ''; let maybe2 = '';
            if (key.endsWith('@maybe')) { key = key.replace('@maybe', ''); maybe1 = ' Maybe'; maybe2 = ' maybe'; }
            if (typeof obj[key] == 'boolean') {
                tacc.push(`  ${separator()} ${key} :${maybe1} Bool`);
                dacc.push(`    ("${key}" :=${maybe2} bool)`);
            } else if (typeof val == 'string') {
                tacc.push(`  ${separator()} ${key} :${maybe1} String`);
                dacc.push(`    ("${key}" :=${maybe2} string)`);
            } else if (typeof val == 'number' && Number.isInteger(val)) {
                tacc.push(`  ${separator()} ${key} :${maybe1} Int`);
                dacc.push(`    ("${key}" :=${maybe2} int)`);
            } else if (typeof val == 'number') {
                tacc.push(`  ${separator()} ${key} :${maybe1} Float`);
                dacc.push(`    ("${key}" :=${maybe2} float)`);
            } else if (typeof val == 'object' && Array.isArray(val)) {
                let x = val[0];
                if (typeof x == 'boolean') {
                    tacc.push(`  ${separator()} ${key} : (List Bool)`);
                    dacc.push(`    ("${key}" := (list bool))`);
                } else if (typeof x == 'string') {
                    tacc.push(`  ${separator()} ${key} : (List String)`);
                    dacc.push(`    ("${key}" := (list string))`);
                } else if (typeof x == 'number' && Number.isInteger(x)) {
                    tacc.push(`  ${separator()} ${key} : (List Int)`);
                    dacc.push(`    ("${key}" := (list int))`);
                } else if (typeof x == 'number') {
                    tacc.push(`  ${separator()} ${key} : (List Float)`);
                    dacc.push(`    ("${key}" := (list float))`);
                } else if (typeof x == 'object' && Array.isArray(x)) {
                    throw new Error('array in array is not supported');
                } else if (typeof x == 'object') {
                    tacc.push(`  ${separator()} ${key} : (List ${x['@type']})`);
                    dacc.push(`    ("${key}" := (list ${x['@type']}Decoder))`);
                    objects.push(x);
                } else {
                    throw new Error('unhandled array type ' + (typeof x));
                }
            } else if (typeof val == 'object') {
                tacc.push(`  ${separator()} ${key} : ${val['@type']}`);
                let tdec2 = val['@type'].charAt(0).toLowerCase() + val['@type'].substring(1);
                dacc.push(`    ("${key}" := ${tdec2}Decoder)`);
                objects.push(val);
            } else {
                throw new Error('unhandled type ' + (typeof val))
            }
            first = false;
            return true;
        });
        tacc.push('  }')
        tacc.push('');
        dacc.push('');
        objects.forEach((object) => genModelObj(object, tacc, dacc));
    }
    // tacc is type accumulator; dacc is decoder accumulator
    let macc = []; let tacc = []; let dacc = [];
    macc.push('module Model');
    macc.push('import Json.Decode exposing (..)\n');
    genModelObj(obj, tacc, dacc);
    return macc.join('\n') + '\n' + tacc.join('\n') + '\n' + dacc.join('\n');    
}


console.log(genModel(pattern));