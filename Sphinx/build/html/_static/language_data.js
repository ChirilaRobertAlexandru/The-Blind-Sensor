/*
 * This script contains the language-specific data used by searchtools.js,
 * namely the list of stopwords, stemmer, scorer and splitter.
 */

var stopwords = [];


/* Non-minified version is copied as a separate JS file, if available */
/**@constructor*/
BaseStemmer = function() {
    this.setCurrent = function(value) {
        this.current = value;
        this.cursor = 0;
        this.limit = this.current.length;
        this.limit_backward = 0;
        this.bra = this.cursor;
        this.ket = this.limit;
    };

    this.getCurrent = function() {
        return this.current;
    };

    this.copy_from = function(other) {
        this.current          = other.current;
        this.cursor           = other.cursor;
        this.limit            = other.limit;
        this.limit_backward   = other.limit_backward;
        this.bra              = other.bra;
        this.ket              = other.ket;
    };

    this.in_grouping = function(s, min, max) {
        if (this.cursor >= this.limit) return false;
        var ch = this.current.charCodeAt(this.cursor);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) return false;
        this.cursor++;
        return true;
    };

    this.in_grouping_b = function(s, min, max) {
        if (this.cursor <= this.limit_backward) return false;
        var ch = this.current.charCodeAt(this.cursor - 1);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) return false;
        this.cursor--;
        return true;
    };

    this.out_grouping = function(s, min, max) {
        if (this.cursor >= this.limit) return false;
        var ch = this.current.charCodeAt(this.cursor);
        if (ch > max || ch < min) {
            this.cursor++;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0X1 << (ch & 0x7))) == 0) {
            this.cursor++;
            return true;
        }
        return false;
    };

    this.out_grouping_b = function(s, min, max) {
        if (this.cursor <= this.limit_backward) return false;
        var ch = this.current.charCodeAt(this.cursor - 1);
        if (ch > max || ch < min) {
            this.cursor--;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) == 0) {
            this.cursor--;
            return true;
        }
        return false;
    };

    this.eq_s = function(s)
    {
        if (this.limit - this.cursor < s.length) return false;
        if (this.current.slice(this.cursor, this.cursor + s.length) != s)
        {
            return false;
        }
        this.cursor += s.length;
        return true;
    };

    this.eq_s_b = function(s)
    {
        if (this.cursor - this.limit_backward < s.length) return false;
        if (this.current.slice(this.cursor - s.length, this.cursor) != s)
        {
            return false;
        }
        this.cursor -= s.length;
        return true;
    };

    /** @return {number} */ this.find_among = function(v)
    {
        var i = 0;
        var j = v.length;

        var c = this.cursor;
        var l = this.limit;

        var common_i = 0;
        var common_j = 0;

        var first_key_inspected = false;

        while (true)
        {
            var k = i + ((j - i) >>> 1);
            var diff = 0;
            var common = common_i < common_j ? common_i : common_j; // smaller
            // w[0]: string, w[1]: substring_i, w[2]: result, w[3]: function (optional)
            var w = v[k];
            var i2;
            for (i2 = common; i2 < w[0].length; i2++)
            {
                if (c + common == l)
                {
                    diff = -1;
                    break;
                }
                diff = this.current.charCodeAt(c + common) - w[0].charCodeAt(i2);
                if (diff != 0) break;
                common++;
            }
            if (diff < 0)
            {
                j = k;
                common_j = common;
            }
            else
            {
                i = k;
                common_i = common;
            }
            if (j - i <= 1)
            {
                if (i > 0) break; // v->s has been inspected
                if (j == i) break; // only one item in v

                // - but now we need to go round once more to get
                // v->s inspected. This looks messy, but is actually
                // the optimal approach.

                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        do {
            var w = v[i];
            if (common_i >= w[0].length)
            {
                this.cursor = c + w[0].length;
                if (w.length < 4) return w[2];
                var res = w[3](this);
                this.cursor = c + w[0].length;
                if (res) return w[2];
            }
            i = w[1];
        } while (i >= 0);
        return 0;
    };

    // find_among_b is for backwards processing. Same comments apply
    this.find_among_b = function(v)
    {
        var i = 0;
        var j = v.length

        var c = this.cursor;
        var lb = this.limit_backward;

        var common_i = 0;
        var common_j = 0;

        var first_key_inspected = false;

        while (true)
        {
            var k = i + ((j - i) >> 1);
            var diff = 0;
            var common = common_i < common_j ? common_i : common_j;
            var w = v[k];
            var i2;
            for (i2 = w[0].length - 1 - common; i2 >= 0; i2--)
            {
                if (c - common == lb)
                {
                    diff = -1;
                    break;
                }
                diff = this.current.charCodeAt(c - 1 - common) - w[0].charCodeAt(i2);
                if (diff != 0) break;
                common++;
            }
            if (diff < 0)
            {
                j = k;
                common_j = common;
            }
            else
            {
                i = k;
                common_i = common;
            }
            if (j - i <= 1)
            {
                if (i > 0) break;
                if (j == i) break;
                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        do {
            var w = v[i];
            if (common_i >= w[0].length)
            {
                this.cursor = c - w[0].length;
                if (w.length < 4) return w[2];
                var res = w[3](this);
                this.cursor = c - w[0].length;
                if (res) return w[2];
            }
            i = w[1];
        } while (i >= 0);
        return 0;
    };

    /* to replace chars between c_bra and c_ket in this.current by the
     * chars in s.
     */
    this.replace_s = function(c_bra, c_ket, s)
    {
        var adjustment = s.length - (c_ket - c_bra);
        this.current = this.current.slice(0, c_bra) + s + this.current.slice(c_ket);
        this.limit += adjustment;
        if (this.cursor >= c_ket) this.cursor += adjustment;
        else if (this.cursor > c_bra) this.cursor = c_bra;
        return adjustment;
    };

    this.slice_check = function()
    {
        if (this.bra < 0 ||
            this.bra > this.ket ||
            this.ket > this.limit ||
            this.limit > this.current.length)
        {
            return false;
        }
        return true;
    };

    this.slice_from = function(s)
    {
        var result = false;
        if (this.slice_check())
        {
            this.replace_s(this.bra, this.ket, s);
            result = true;
        }
        return result;
    };

    this.slice_del = function()
    {
        return this.slice_from("");
    };

    this.insert = function(c_bra, c_ket, s)
    {
        var adjustment = this.replace_s(c_bra, c_ket, s);
        if (c_bra <= this.bra) this.bra += adjustment;
        if (c_bra <= this.ket) this.ket += adjustment;
    };

    this.slice_to = function()
    {
        var result = '';
        if (this.slice_check())
        {
            result = this.current.slice(this.bra, this.ket);
        }
        return result;
    };

    this.assign_to = function()
    {
        return this.current.slice(0, this.limit);
    };
};

// Generated by Snowball 2.1.0 - https://snowballstem.org/

/**@constructor*/
RomanianStemmer = function() {
    var base = new BaseStemmer();
    /** @const */ var a_0 = [
        ["", -1, 3],
        ["I", 0, 1],
        ["U", 0, 2]
    ];

    /** @const */ var a_1 = [
        ["ea", -1, 3],
        ["a\u0163ia", -1, 7],
        ["aua", -1, 2],
        ["iua", -1, 4],
        ["a\u0163ie", -1, 7],
        ["ele", -1, 3],
        ["ile", -1, 5],
        ["iile", 6, 4],
        ["iei", -1, 4],
        ["atei", -1, 6],
        ["ii", -1, 4],
        ["ului", -1, 1],
        ["ul", -1, 1],
        ["elor", -1, 3],
        ["ilor", -1, 4],
        ["iilor", 14, 4]
    ];

    /** @const */ var a_2 = [
        ["icala", -1, 4],
        ["iciva", -1, 4],
        ["ativa", -1, 5],
        ["itiva", -1, 6],
        ["icale", -1, 4],
        ["a\u0163iune", -1, 5],
        ["i\u0163iune", -1, 6],
        ["atoare", -1, 5],
        ["itoare", -1, 6],
        ["\u0103toare", -1, 5],
        ["icitate", -1, 4],
        ["abilitate", -1, 1],
        ["ibilitate", -1, 2],
        ["ivitate", -1, 3],
        ["icive", -1, 4],
        ["ative", -1, 5],
        ["itive", -1, 6],
        ["icali", -1, 4],
        ["atori", -1, 5],
        ["icatori", 18, 4],
        ["itori", -1, 6],
        ["\u0103tori", -1, 5],
        ["icitati", -1, 4],
        ["abilitati", -1, 1],
        ["ivitati", -1, 3],
        ["icivi", -1, 4],
        ["ativi", -1, 5],
        ["itivi", -1, 6],
        ["icit\u0103i", -1, 4],
        ["abilit\u0103i", -1, 1],
        ["ivit\u0103i", -1, 3],
        ["icit\u0103\u0163i", -1, 4],
        ["abilit\u0103\u0163i", -1, 1],
        ["ivit\u0103\u0163i", -1, 3],
        ["ical", -1, 4],
        ["ator", -1, 5],
        ["icator", 35, 4],
        ["itor", -1, 6],
        ["\u0103tor", -1, 5],
        ["iciv", -1, 4],
        ["ativ", -1, 5],
        ["itiv", -1, 6],
        ["ical\u0103", -1, 4],
        ["iciv\u0103", -1, 4],
        ["ativ\u0103", -1, 5],
        ["itiv\u0103", -1, 6]
    ];

    /** @const */ var a_3 = [
        ["ica", -1, 1],
        ["abila", -1, 1],
        ["ibila", -1, 1],
        ["oasa", -1, 1],
        ["ata", -1, 1],
        ["ita", -1, 1],
        ["anta", -1, 1],
        ["ista", -1, 3],
        ["uta", -1, 1],
        ["iva", -1, 1],
        ["ic", -1, 1],
        ["ice", -1, 1],
        ["abile", -1, 1],
        ["ibile", -1, 1],
        ["isme", -1, 3],
        ["iune", -1, 2],
        ["oase", -1, 1],
        ["ate", -1, 1],
        ["itate", 17, 1],
        ["ite", -1, 1],
        ["ante", -1, 1],
        ["iste", -1, 3],
        ["ute", -1, 1],
        ["ive", -1, 1],
        ["ici", -1, 1],
        ["abili", -1, 1],
        ["ibili", -1, 1],
        ["iuni", -1, 2],
        ["atori", -1, 1],
        ["osi", -1, 1],
        ["ati", -1, 1],
        ["itati", 30, 1],
        ["iti", -1, 1],
        ["anti", -1, 1],
        ["isti", -1, 3],
        ["uti", -1, 1],
        ["i\u015Fti", -1, 3],
        ["ivi", -1, 1],
        ["it\u0103i", -1, 1],
        ["o\u015Fi", -1, 1],
        ["it\u0103\u0163i", -1, 1],
        ["abil", -1, 1],
        ["ibil", -1, 1],
        ["ism", -1, 3],
        ["ator", -1, 1],
        ["os", -1, 1],
        ["at", -1, 1],
        ["it", -1, 1],
        ["ant", -1, 1],
        ["ist", -1, 3],
        ["ut", -1, 1],
        ["iv", -1, 1],
        ["ic\u0103", -1, 1],
        ["abil\u0103", -1, 1],
        ["ibil\u0103", -1, 1],
        ["oas\u0103", -1, 1],
        ["at\u0103", -1, 1],
        ["it\u0103", -1, 1],
        ["ant\u0103", -1, 1],
        ["ist\u0103", -1, 3],
        ["ut\u0103", -1, 1],
        ["iv\u0103", -1, 1]
    ];

    /** @const */ var a_4 = [
        ["ea", -1, 1],
        ["ia", -1, 1],
        ["esc", -1, 1],
        ["\u0103sc", -1, 1],
        ["ind", -1, 1],
        ["\u00E2nd", -1, 1],
        ["are", -1, 1],
        ["ere", -1, 1],
        ["ire", -1, 1],
        ["\u00E2re", -1, 1],
        ["se", -1, 2],
        ["ase", 10, 1],
        ["sese", 10, 2],
        ["ise", 10, 1],
        ["use", 10, 1],
        ["\u00E2se", 10, 1],
        ["e\u015Fte", -1, 1],
        ["\u0103\u015Fte", -1, 1],
        ["eze", -1, 1],
        ["ai", -1, 1],
        ["eai", 19, 1],
        ["iai", 19, 1],
        ["sei", -1, 2],
        ["e\u015Fti", -1, 1],
        ["\u0103\u015Fti", -1, 1],
        ["ui", -1, 1],
        ["ezi", -1, 1],
        ["\u00E2i", -1, 1],
        ["a\u015Fi", -1, 1],
        ["se\u015Fi", -1, 2],
        ["ase\u015Fi", 29, 1],
        ["sese\u015Fi", 29, 2],
        ["ise\u015Fi", 29, 1],
        ["use\u015Fi", 29, 1],
        ["\u00E2se\u015Fi", 29, 1],
        ["i\u015Fi", -1, 1],
        ["u\u015Fi", -1, 1],
        ["\u00E2\u015Fi", -1, 1],
        ["a\u0163i", -1, 2],
        ["ea\u0163i", 38, 1],
        ["ia\u0163i", 38, 1],
        ["e\u0163i", -1, 2],
        ["i\u0163i", -1, 2],
        ["\u00E2\u0163i", -1, 2],
        ["ar\u0103\u0163i", -1, 1],
        ["ser\u0103\u0163i", -1, 2],
        ["aser\u0103\u0163i", 45, 1],
        ["seser\u0103\u0163i", 45, 2],
        ["iser\u0103\u0163i", 45, 1],
        ["user\u0103\u0163i", 45, 1],
        ["\u00E2ser\u0103\u0163i", 45, 1],
        ["ir\u0103\u0163i", -1, 1],
        ["ur\u0103\u0163i", -1, 1],
        ["\u00E2r\u0103\u0163i", -1, 1],
        ["am", -1, 1],
        ["eam", 54, 1],
        ["iam", 54, 1],
        ["em", -1, 2],
        ["asem", 57, 1],
        ["sesem", 57, 2],
        ["isem", 57, 1],
        ["usem", 57, 1],
        ["\u00E2sem", 57, 1],
        ["im", -1, 2],
        ["\u00E2m", -1, 2],
        ["\u0103m", -1, 2],
        ["ar\u0103m", 65, 1],
        ["ser\u0103m", 65, 2],
        ["aser\u0103m", 67, 1],
        ["seser\u0103m", 67, 2],
        ["iser\u0103m", 67, 1],
        ["user\u0103m", 67, 1],
        ["\u00E2ser\u0103m", 67, 1],
        ["ir\u0103m", 65, 1],
        ["ur\u0103m", 65, 1],
        ["\u00E2r\u0103m", 65, 1],
        ["au", -1, 1],
        ["eau", 76, 1],
        ["iau", 76, 1],
        ["indu", -1, 1],
        ["\u00E2ndu", -1, 1],
        ["ez", -1, 1],
        ["easc\u0103", -1, 1],
        ["ar\u0103", -1, 1],
        ["ser\u0103", -1, 2],
        ["aser\u0103", 84, 1],
        ["seser\u0103", 84, 2],
        ["iser\u0103", 84, 1],
        ["user\u0103", 84, 1],
        ["\u00E2ser\u0103", 84, 1],
        ["ir\u0103", -1, 1],
        ["ur\u0103", -1, 1],
        ["\u00E2r\u0103", -1, 1],
        ["eaz\u0103", -1, 1]
    ];

    /** @const */ var a_5 = [
        ["a", -1, 1],
        ["e", -1, 1],
        ["ie", 1, 1],
        ["i", -1, 1],
        ["\u0103", -1, 1]
    ];

    /** @const */ var /** Array<int> */ g_v = [17, 65, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 32, 0, 0, 4];

    var /** boolean */ B_standard_suffix_removed = false;
    var /** number */ I_p2 = 0;
    var /** number */ I_p1 = 0;
    var /** number */ I_pV = 0;


    /** @return {boolean} */
    function r_prelude() {
        while(true)
        {
            var /** number */ v_1 = base.cursor;
            lab0: {
                golab1: while(true)
                {
                    var /** number */ v_2 = base.cursor;
                    lab2: {
                        if (!(base.in_grouping(g_v, 97, 259)))
                        {
                            break lab2;
                        }
                        base.bra = base.cursor;
                        lab3: {
                            var /** number */ v_3 = base.cursor;
                            lab4: {
                                if (!(base.eq_s("u")))
                                {
                                    break lab4;
                                }
                                base.ket = base.cursor;
                                if (!(base.in_grouping(g_v, 97, 259)))
                                {
                                    break lab4;
                                }
                                if (!base.slice_from("U"))
                                {
                                    return false;
                                }
                                break lab3;
                            }
                            base.cursor = v_3;
                            if (!(base.eq_s("i")))
                            {
                                break lab2;
                            }
                            base.ket = base.cursor;
                            if (!(base.in_grouping(g_v, 97, 259)))
                            {
                                break lab2;
                            }
                            if (!base.slice_from("I"))
                            {
                                return false;
                            }
                        }
                        base.cursor = v_2;
                        break golab1;
                    }
                    base.cursor = v_2;
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
                continue;
            }
            base.cursor = v_1;
            break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_mark_regions() {
        I_pV = base.limit;
        I_p1 = base.limit;
        I_p2 = base.limit;
        var /** number */ v_1 = base.cursor;
        lab0: {
            lab1: {
                var /** number */ v_2 = base.cursor;
                lab2: {
                    if (!(base.in_grouping(g_v, 97, 259)))
                    {
                        break lab2;
                    }
                    lab3: {
                        var /** number */ v_3 = base.cursor;
                        lab4: {
                            if (!(base.out_grouping(g_v, 97, 259)))
                            {
                                break lab4;
                            }
                            golab5: while(true)
                            {
                                lab6: {
                                    if (!(base.in_grouping(g_v, 97, 259)))
                                    {
                                        break lab6;
                                    }
                                    break golab5;
                                }
                                if (base.cursor >= base.limit)
                                {
                                    break lab4;
                                }
                                base.cursor++;
                            }
                            break lab3;
                        }
                        base.cursor = v_3;
                        if (!(base.in_grouping(g_v, 97, 259)))
                        {
                            break lab2;
                        }
                        golab7: while(true)
                        {
                            lab8: {
                                if (!(base.out_grouping(g_v, 97, 259)))
                                {
                                    break lab8;
                                }
                                break golab7;
                            }
                            if (base.cursor >= base.limit)
                            {
                                break lab2;
                            }
                            base.cursor++;
                        }
                    }
                    break lab1;
                }
                base.cursor = v_2;
                if (!(base.out_grouping(g_v, 97, 259)))
                {
                    break lab0;
                }
                lab9: {
                    var /** number */ v_6 = base.cursor;
                    lab10: {
                        if (!(base.out_grouping(g_v, 97, 259)))
                        {
                            break lab10;
                        }
                        golab11: while(true)
                        {
                            lab12: {
                                if (!(base.in_grouping(g_v, 97, 259)))
                                {
                                    break lab12;
                                }
                                break golab11;
                            }
                            if (base.cursor >= base.limit)
                            {
                                break lab10;
                            }
                            base.cursor++;
                        }
                        break lab9;
                    }
                    base.cursor = v_6;
                    if (!(base.in_grouping(g_v, 97, 259)))
                    {
                        break lab0;
                    }
                    if (base.cursor >= base.limit)
                    {
                        break lab0;
                    }
                    base.cursor++;
                }
            }
            I_pV = base.cursor;
        }
        base.cursor = v_1;
        var /** number */ v_8 = base.cursor;
        lab13: {
            golab14: while(true)
            {
                lab15: {
                    if (!(base.in_grouping(g_v, 97, 259)))
                    {
                        break lab15;
                    }
                    break golab14;
                }
                if (base.cursor >= base.limit)
                {
                    break lab13;
                }
                base.cursor++;
            }
            golab16: while(true)
            {
                lab17: {
                    if (!(base.out_grouping(g_v, 97, 259)))
                    {
                        break lab17;
                    }
                    break golab16;
                }
                if (base.cursor >= base.limit)
                {
                    break lab13;
                }
                base.cursor++;
            }
            I_p1 = base.cursor;
            golab18: while(true)
            {
                lab19: {
                    if (!(base.in_grouping(g_v, 97, 259)))
                    {
                        break lab19;
                    }
                    break golab18;
                }
                if (base.cursor >= base.limit)
                {
                    break lab13;
                }
                base.cursor++;
            }
            golab20: while(true)
            {
                lab21: {
                    if (!(base.out_grouping(g_v, 97, 259)))
                    {
                        break lab21;
                    }
                    break golab20;
                }
                if (base.cursor >= base.limit)
                {
                    break lab13;
                }
                base.cursor++;
            }
            I_p2 = base.cursor;
        }
        base.cursor = v_8;
        return true;
    };

    /** @return {boolean} */
    function r_postlude() {
        var /** number */ among_var;
        while(true)
        {
            var /** number */ v_1 = base.cursor;
            lab0: {
                base.bra = base.cursor;
                among_var = base.find_among(a_0);
                if (among_var == 0)
                {
                    break lab0;
                }
                base.ket = base.cursor;
                switch (among_var) {
                    case 1:
                        if (!base.slice_from("i"))
                        {
                            return false;
                        }
                        break;
                    case 2:
                        if (!base.slice_from("u"))
                        {
                            return false;
                        }
                        break;
                    case 3:
                        if (base.cursor >= base.limit)
                        {
                            break lab0;
                        }
                        base.cursor++;
                        break;
                }
                continue;
            }
            base.cursor = v_1;
            break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_RV() {
        if (!(I_pV <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_R1() {
        if (!(I_p1 <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_R2() {
        if (!(I_p2 <= base.cursor))
        {
            return false;
        }
        return true;
    };

    /** @return {boolean} */
    function r_step_0() {
        var /** number */ among_var;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_1);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_R1())
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("a"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("e"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("i"))
                {
                    return false;
                }
                break;
            case 5:
                {
                    var /** number */ v_1 = base.limit - base.cursor;
                    lab0: {
                        if (!(base.eq_s_b("ab")))
                        {
                            break lab0;
                        }
                        return false;
                    }
                    base.cursor = base.limit - v_1;
                }
                if (!base.slice_from("i"))
                {
                    return false;
                }
                break;
            case 6:
                if (!base.slice_from("at"))
                {
                    return false;
                }
                break;
            case 7:
                if (!base.slice_from("a\u0163i"))
                {
                    return false;
                }
                break;
        }
        return true;
    };

    /** @return {boolean} */
    function r_combo_suffix() {
        var /** number */ among_var;
        var /** number */ v_1 = base.limit - base.cursor;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_2);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_R1())
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_from("abil"))
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_from("ibil"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("iv"))
                {
                    return false;
                }
                break;
            case 4:
                if (!base.slice_from("ic"))
                {
                    return false;
                }
                break;
            case 5:
                if (!base.slice_from("at"))
                {
                    return false;
                }
                break;
            case 6:
                if (!base.slice_from("it"))
                {
                    return false;
                }
                break;
        }
        B_standard_suffix_removed = true;
        base.cursor = base.limit - v_1;
        return true;
    };

    /** @return {boolean} */
    function r_standard_suffix() {
        var /** number */ among_var;
        B_standard_suffix_removed = false;
        while(true)
        {
            var /** number */ v_1 = base.limit - base.cursor;
            lab0: {
                if (!r_combo_suffix())
                {
                    break lab0;
                }
                continue;
            }
            base.cursor = base.limit - v_1;
            break;
        }
        base.ket = base.cursor;
        among_var = base.find_among_b(a_3);
        if (among_var == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_R2())
        {
            return false;
        }
        switch (among_var) {
            case 1:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!(base.eq_s_b("\u0163")))
                {
                    return false;
                }
                base.bra = base.cursor;
                if (!base.slice_from("t"))
                {
                    return false;
                }
                break;
            case 3:
                if (!base.slice_from("ist"))
                {
                    return false;
                }
                break;
        }
        B_standard_suffix_removed = true;
        return true;
    };

    /** @return {boolean} */
    function r_verb_suffix() {
        var /** number */ among_var;
        if (base.cursor < I_pV)
        {
            return false;
        }
        var /** number */ v_2 = base.limit_backward;
        base.limit_backward = I_pV;
        base.ket = base.cursor;
        among_var = base.find_among_b(a_4);
        if (among_var == 0)
        {
            base.limit_backward = v_2;
            return false;
        }
        base.bra = base.cursor;
        switch (among_var) {
            case 1:
                lab0: {
                    var /** number */ v_3 = base.limit - base.cursor;
                    lab1: {
                        if (!(base.out_grouping_b(g_v, 97, 259)))
                        {
                            break lab1;
                        }
                        break lab0;
                    }
                    base.cursor = base.limit - v_3;
                    if (!(base.eq_s_b("u")))
                    {
                        base.limit_backward = v_2;
                        return false;
                    }
                }
                if (!base.slice_del())
                {
                    return false;
                }
                break;
            case 2:
                if (!base.slice_del())
                {
                    return false;
                }
                break;
        }
        base.limit_backward = v_2;
        return true;
    };

    /** @return {boolean} */
    function r_vowel_suffix() {
        base.ket = base.cursor;
        if (base.find_among_b(a_5) == 0)
        {
            return false;
        }
        base.bra = base.cursor;
        if (!r_RV())
        {
            return false;
        }
        if (!base.slice_del())
        {
            return false;
        }
        return true;
    };

    this.stem = /** @return {boolean} */ function() {
        var /** number */ v_1 = base.cursor;
        r_prelude();
        base.cursor = v_1;
        r_mark_regions();
        base.limit_backward = base.cursor; base.cursor = base.limit;
        var /** number */ v_3 = base.limit - base.cursor;
        r_step_0();
        base.cursor = base.limit - v_3;
        var /** number */ v_4 = base.limit - base.cursor;
        r_standard_suffix();
        base.cursor = base.limit - v_4;
        var /** number */ v_5 = base.limit - base.cursor;
        lab0: {
            lab1: {
                var /** number */ v_6 = base.limit - base.cursor;
                lab2: {
                    if (!B_standard_suffix_removed)
                    {
                        break lab2;
                    }
                    break lab1;
                }
                base.cursor = base.limit - v_6;
                if (!r_verb_suffix())
                {
                    break lab0;
                }
            }
        }
        base.cursor = base.limit - v_5;
        var /** number */ v_7 = base.limit - base.cursor;
        r_vowel_suffix();
        base.cursor = base.limit - v_7;
        base.cursor = base.limit_backward;
        var /** number */ v_8 = base.cursor;
        r_postlude();
        base.cursor = v_8;
        return true;
    };

    /**@return{string}*/
    this['stemWord'] = function(/**string*/word) {
        base.setCurrent(word);
        this.stem();
        return base.getCurrent();
    };
};

Stemmer = RomanianStemmer;
