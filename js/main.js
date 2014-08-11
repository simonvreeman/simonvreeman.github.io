// Enjoy your day
(function () {
  var today;
  today = function () {
    var dayNames, now;
    dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    now = new Date();
    return dayNames[now.getDay()];
  };
  $(function () {
    var $day;
    $day = $('[data-day]');
    return $day.text(today());
  });
}).call(this);

// Don't forget me!
// Example: http://www.mt.nl
// var focusTitle = "";
// var blurTitle  = "Dont' forget me!";
// jQuery(window).addEvent('blur', function() {
//   focusTitle = $$('title').shift().innerHTML;
//   $$('title').shift().innerHTML = blurTitle + " | " + focusTitle;
// });
// jQuery(window).addEvent('focus', function() {
//   if (focusTitle.length > 0) {
//     $$('title').shift().innerHTML = focusTitle;
//   }
// });

// Auto-growing textareas; technique ripped from Facebook
(function ($) {
  $.fn.autogrow = function(options) {
    this.filter('textarea').each(function() {
      var $this = $(this), minHeight = $this.height(), lineHeight = $this.css('lineHeight');
      var shadow = $('<div></div>').css({
        position: 'absolute',
        top: -10000,
        left: -10000,
        width: $(this).width(),
        fontSize: $this.css('fontSize'),
        fontFamily: $this.css('fontFamily'),
        lineHeight: $this.css('lineHeight'),
        resize: 'none'
      }).appendTo(document.body);
      var update = function() {
        var val = this.value.replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&/g, '&amp;')
        .replace(/\n/g, '<br/>');
        shadow.html(val);
        $(this).css('height', Math.max(shadow.height() + 20, minHeight));
      }
      $(this).change(update).keyup(update).keydown(update);
        update.apply(this);
    });
    return this;
  }
})(jQuery);

// Google Analytics Campaign URL Builder
function updateOutput() {
  var domain = $('#domain').val();
  var source = $('#source').val();
  var medium = $('#medium').val();
  var term = $('#term').val();
  var content = $('#content').val();
  var name = $('#name').val();

  var html = domain+'?utm_source='+encodeURIComponent(source)+'&utm_medium='+encodeURIComponent(medium)+'&utm_campaign='+encodeURIComponent(name);
  if (term) {
    var html = html + '&utm_term='+encodeURIComponent(term);
  }
  if (content) {
    var html = html + '&utm_content='+encodeURIComponent(content);
  }

  if (domain && source && medium && name) {
    $('#url').html(html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    $('#url').change();
  }
  else {
    $('#url').html('');
    $('#url').change();
  }
}

function initpage() {
  $('.auto').autogrow();
  $('.auto').click(function() {
    $(this).select();
  });
  $('input').keyup(window.updateOutput);
  $('input').click(window.updateOutput);
  $('select').change(window.updateOutput);

  updateOutput();
}
$(window.initpage);

// A/B Test Significance Calculator
function jstat() {}

function get_field_values() {
    return {
        a_visits: $("#a_visits").val().replace(/[^0-9.]/g, ""),
        b_visits: $("#b_visits").val().replace(/[^0-9.]/g, ""),
        a_conversions: $("#a_conversions").val().replace(/[^0-9.]/g, ""),
        b_conversions: $("#b_conversions").val().replace(/[^0-9.]/g, "")
    }
}

function calculate_conversion(t) {
    var i = get_field_values();
    if ("a" == t) var e = 100 * (i.a_conversions / i.a_visits);
    else if ("b" == t) var e = 100 * (i.b_conversions / i.b_visits);
    return e > 100 ? 100 : isNaN(e) ? 0 : e
}

function append_warning(t, i, e) {
    $(".warning").remove(), t.val(i), t.parent().append('<span class="warning">' + e + "</span>"), $(".warning").hide().fadeIn("fast").delay(2e3).fadeOut("fast")
}

function validate_inputs() {
    var t = get_field_values();
    parseInt(t.a_visits) < parseInt(t.a_conversions) ? $("#a_visits").append('<span class="warning">Visitors must be greater than conversions.</span>') : $(".warning").remove(), parseInt(t.b_visits) < parseInt(t.b_conversions) ? $("#b_visits").parent().append('<span class="warning">Visitors must be greater than conversions.</span>') : $(".warning").remove()
}

function calculate_certainty(t, i) {
    if (t >= 0 && i >= 0) {
        t /= 100, i /= 100;
        var e = get_field_values(),
            n = Math.sqrt(t * (1 - t) / e.a_visits),
            a = Math.sqrt(i * (1 - i) / e.b_visits),
            s = (t - i) / Math.sqrt(Math.pow(n, 2) + Math.pow(a, 2));
        if (t > i) var r = jstat.pnorm(s, 0, 1, null, null);
        else var r = 1 - jstat.pnorm(s, 0, 1, null, null);
        return 100 * r
    }
    return 0
}

function determine_winner(t, i, e) {
    return 90 > e ? ($("#row1").toggleClass("success", !1), $("#row1_label").toggleClass("row_label_success", !1), $("#row1 input").toggleClass("input_success", !1), $("#row1 strong").toggleClass("conv_success", !1), $("#row2").toggleClass("success", !1), $("#row2_label").toggleClass("row_label_success", !1), $("#row2 input").toggleClass("input_success", !1), $("#row2 strong").toggleClass("conv_success", !1), t > i ? "A" : "B") : t > i ? ($("#row1").toggleClass("success", !0), $("#row1_label").toggleClass("row_label_success", !0), $("#row1 input").toggleClass("input_success", !0), $("#row1 strong").toggleClass("conv_success", !0), $("#row2").toggleClass("success", !1), $("#row2_label").toggleClass("row_label_success", !1), $("#row2 input").toggleClass("input_success", !1), $("#row2 strong").toggleClass("conv_success", !1), "A") : ($("#row1").toggleClass("success", !1), $("#row1_label").toggleClass("row_label_success", !1), $("#row1 input").toggleClass("input_success", !1), $("#row1 strong").toggleClass("conv_success", !1), $("#row2").toggleClass("success", !0), $("#row2_label").toggleClass("row_label_success", !0), $("#row2 input").toggleClass("input_success", !0), $("#row2 strong").toggleClass("conv_success", !0), "B")
}

function determine_loser(t) {
    return "B" == t ? "A" : "B"
}

function calculate_winner_improvement(t, i, e) {
    if ("A" == e) {
        $("#winner_conversion").text(Math.round(t) + "%");
        var n = (t - i) / i
    } else {
        $("#winner_conversion").text(Math.round(i) + "%");
        var n = (i - t) / t
    }
    return 100 * n
}

function determine_statistical_significance(t) {
    if (t >= 95) var i = "Your A/B test is statistically significant!";
    else if (t >= 90) var i = "It is questionable whether your results are statistically significant.";
    else var i = "Unfortunately, your results are not statistically significant.";
    return i
}

function add_row() {}

// function attach_net_conv_info_for_rank(t) {
//    "SaaS / Subscription" == $("#business_type").val() && t.append('<span class="info">Start: Home page. <br/> End: Signup completed. <br/> Not sure what this is? Try <a href="http://kissmetrics.com">KISSmetrics</a> to calculate your signup conversion.</span>'), "Daily Deals" == $("#business_type").val() && t.append('<span class="info">Start: Viewed deal. <br/> End: Bought deal. <br/> Not sure what this is? Try <a href="http://kissmetrics.com">KISSmetrics</a> to calculate your purchase conversion.</span>'), "Ecommerce" == $("#business_type").val() && t.append('<span class="info">Start: Viewed product. <br/> End: Checked out. <br/> Not sure what this is? Try <a href="http://kissmetrics.com">KISSmetrics</a> to calculate your purchase conversion.</span>'), "Indirect Monetization" == $("#business_type").val() && t.append('<span class="info">Start: Home page. <br/> End: Signup completed. <br/> Not sure what this is? Try <a href="http://kissmetrics.com">KISSmetrics</a> to calculate your signup conversion.</span>')
// }

function add_commas(t) {
    t += "", x = t.split("."), x1 = x[0], x2 = x.length > 1 ? "." + x[1] : "";
    for (var i = /(\d+)(\d{3})/; i.test(x1);) x1 = x1.replace(i, "$1,$2");
    return x1 + x2
}

function calculate_conversion_rate() {
    var t = get_field_values(),
        i = t.monthly_uniques * t.conversion_worth * (t.net_conversion_rate / 100);
    return Math.round(i)
}

function remove_class(t, i, e) {
    setTimeout(function () {
        t.removeClass(i), t.find(".soon_message") && t.find(".soon_message").remove()
    }, e)
}

function submit_mailchimp_form() {
    $("#mc-embedded-subscribe").click(function (t) {
        t.preventDefault(), $("#mc-embedded-subscribe-form").submit(), t.preventDefault()
    }), $("#mc-embedded-subscribe-form").submit(function (t) {
        var i = !1;
        $("#mc-embedded-subscribe-form p").find(".exclaim").remove(), $(this).find(".text").each(function () {
            "" == $(this).val() ? (t.preventDefault(), i = !0, $(this).parent().addClass("shake"), $(this).parent().append('<span class="exclaim">!</span>'), $(this).addClass("error")) : ("mce-EMAIL" == $(this).attr("id") || "email" == $(this).attr("class")) && (validate_email($(this).val(), !1) || (t.preventDefault(), i = !0, $(this).parent().addClass("shake"), $(this).parent().append('<span class="exclaim">!</span>'), $(this).addClass("error")))
        }), i || ($("#mc-embedded-subscribe-form").fadeOut(function () {
            $(".signup").append('<p class="thanks"><strong>Thank you!</strong> You&rsquo;ll receive an email shortly to confirm your subscription.</p>'), $(".email_subscribe").append('<p class="thanks"><strong>Thank you!</strong> You&rsquo;ll receive an email shortly to confirm your subscription.</p>'), $(".thanks").hide().fadeIn()
        }), _kmq.push(["identify", "'" + $("#mce-EMAIL").val() + "'"]), _kmq.push(["record", "Submitted Email Form"]))
    })
}

function validate_email(t, i) {
    if ("" == t && i) return !0;
    var e = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return e.test(t)
}
j = jstat,
    function () {
        var t = !1,
            i = /xyz/.test(function () {}) ? /\b_super\b/ : /.*/;
        this.Class = function () {}, Class.extend = function (e) {
            function n() {
                !t && this.init && this.init.apply(this, arguments)
            }
            var a = this.prototype;
            t = !0;
            var s = new this;
            t = !1;
            for (var r in e) s[r] = "function" == typeof e[r] && "function" == typeof a[r] && i.test(e[r]) ? function (t, i) {
                return function () {
                    var e = this._super;
                    this._super = a[t];
                    var n = i.apply(this, arguments);
                    return this._super = e, n
                }
            }(r, e[r]) : e[r];
            return n.prototype = s, n.constructor = n, n.extend = arguments.callee, n
        }
    }(), jstat.ONE_SQRT_2PI = .3989422804014327, jstat.LN_SQRT_2PI = .9189385332046728, jstat.LN_SQRT_PId2 = .22579135264472744, jstat.DBL_MIN = 2.22507e-308, jstat.DBL_EPSILON = 2.220446049250313e-16, jstat.SQRT_32 = 5.656854249492381, jstat.TWO_PI = 6.283185307179586, jstat.DBL_MIN_EXP = -999, jstat.SQRT_2dPI = .79788456080287, jstat.LN_SQRT_PI = .5723649429247, jstat.seq = function (t, i, e) {
        var n = new Range(t, i, e);
        return n.getPoints()
    }, jstat.dnorm = function (t, i, e, n) {
        null == i && (i = 0), null == e && (e = 1), null == n && (n = !1);
        var a = new NormalDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var s = [], r = 0; r < t.length; r++) s.push(a._pdf(t[r], n));
                return s
            }
            throw "Illegal argument: x"
        }
        return a._pdf(t, n)
    }, jstat.pnorm = function (t, i, e, n, a) {
        null == i && (i = 0), null == e && (e = 1), null == n && (n = !0), null == a && (a = !1);
        var s = new NormalDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var r = [], o = 0; o < t.length; o++) r.push(s._cdf(t[o], n, a));
                return r
            }
            throw "Illegal argument: x"
        }
        return s._cdf(t, n, a)
    }, jstat.dlnorm = function (t, i, e, n) {
        null == i && (i = 0), null == e && (e = 1), null == n && (n = !1);
        var a = new LogNormalDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var s = [], r = 0; r < t.length; r++) s.push(a._pdf(t[r], n));
                return s
            }
            throw "Illegal argument: x"
        }
        return a._pdf(t, n)
    }, jstat.plnorm = function (t, i, e, n, a) {
        null == i && (i = 0), null == e && (e = 1), null == n && (n = !0), null == a && (a = !1);
        var s = new LogNormalDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var r = [], o = 0; o < t.length; o++) r.push(s._cdf(t[o], n, a));
                return r
            }
            throw "Illegal argument: x"
        }
        return s._cdf(t, n, a)
    }, jstat.dbeta = function (t, i, e, n, a) {
        null == n && (n = 0), null == a && (a = !1);
        var s = new BetaDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var r = [], o = 0; o < t.length; o++) r.push(s._pdf(t[o], a));
                return r
            }
            throw "Illegal argument: x"
        }
        return s._pdf(t, a)
    }, jstat.pbeta = function (t, i, e, n, a, s) {
        null == n && (n = 0), null == s && (s = !1), null == a && (a = !0);
        var r = new BetaDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var o = [], l = 0; l < t.length; l++) o.push(r._cdf(t[l], a, s));
                return o
            }
            throw "Illegal argument: x"
        }
        return r._cdf(t, a, s)
    }, jstat.dgamma = function (t, i, e, n, a) {
        null == e && (e = 1), null == n && (n = 1 / e), null == a && (a = !1);
        var s = new GammaDistribution(i, n);
        if (isNaN(t)) {
            if (t.length) {
                for (var r = [], o = 0; o < t.length; o++) r.push(s._pdf(t[o], a));
                return r
            }
            throw "Illegal argument: x"
        }
        return s._pdf(t, a)
    }, jstat.pgamma = function (t, i, e, n, a, s) {
        null == e && (e = 1), null == n && (n = 1 / e), null == a && (a = !0), null == s && (s = !1);
        var r = new GammaDistribution(i, n);
        if (isNaN(t)) {
            if (t.length) {
                for (var o = [], l = 0; l < t.length; l++) o.push(r._cdf(t[l], a, s));
                return o
            }
            throw "Illegal argument: x"
        }
        return r._cdf(t, a, s)
    }, jstat.dt = function (t, i, e, n) {
        null == n && (n = !1);
        var a = new StudentTDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var s = [], r = 0; r < t.length; r++) s.push(a._pdf(t[r], n));
                return s
            }
            throw "Illegal argument: x"
        }
        return a._pdf(t, n)
    }, jstat.pt = function (t, i, e, n, a) {
        null == n && (n = !0), null == a && (a = !1);
        var s = new StudentTDistribution(i, e);
        if (isNaN(t)) {
            if (t.length) {
                for (var r = [], o = 0; o < t.length; o++) r.push(s._cdf(t[o], n, a));
                return r
            }
            throw "Illegal argument: x"
        }
        return s._cdf(t, n, a)
    }, jstat.plot = function (t, i, e) {
        if (null == t) throw "x is undefined in jstat.plot";
        if (null == i) throw "y is undefined in jstat.plot";
        if (t.length != i.length) throw "x and y lengths differ in jstat.plot";
        var n = {
                series: {
                    lines: {},
                    points: {}
                }
            },
            a = [];
        if (void 0 == t.length) a.push([t, i]), n.series.points.show = !0;
        else
            for (var s = 0; s < t.length; s++) a.push([t[s], i[s]]);
        var r = "jstat graph";
        null != e && (null != e.type && ("l" == e.type ? n.series.lines.show = !0 : "p" == e.type && (n.series.lines.show = !1, n.series.points.show = !0)), null != e.hover && (n.grid = {
            hoverable: e.hover
        }), null != e.main && (r = e.main));
        var o = new Date,
            l = o.getMilliseconds() * o.getMinutes() + o.getSeconds();
        $("body").append('<div title="' + r + '" style="display: none;" id="' + l + '"><div id="graph-' + l + '" style="width:95%; height: 95%"></div></div>'), $("#" + l).dialog({
            modal: !1,
            width: 475,
            height: 475,
            resizable: !0,
            resize: function () {
                $.plot($("#graph-" + l), [a], n)
            },
            open: function () {
                $.plot($("#graph-" + l), [a], n)
            }
        })
    }, jstat.log10 = function (t) {
        return Math.log(t) / Math.LN10
    }, jstat.toSigFig = function (t, i) {
        if (0 == t) return 0;
        var e = Math.ceil(jstat.log10(0 > t ? -t : t)),
            n = i - parseInt(e),
            a = Math.pow(10, n),
            s = Math.round(t * a);
        return s / a
    }, jstat.trunc = function (t) {
        return t > 0 ? Math.floor(t) : Math.ceil(t)
    }, jstat.isFinite = function (t) {
        return !isNaN(t) && t != Number.POSITIVE_INFINITY && t != Number.NEGATIVE_INFINITY
    }, jstat.dopois_raw = function (t, i, e) {
        if (0 == i) return 0 == t ? e ? 0 : 1 : e ? Number.NEGATIVE_INFINITY : 0;
        if (!jstat.isFinite(i)) return e ? Number.NEGATIVE_INFINITY : 0;
        if (0 > t) return e ? Number.NEGATIVE_INFINITY : 0;
        if (t <= i * jstat.DBL_MIN) return e ? -i : Math.exp(-i);
        if (i < t * jstat.DBL_MIN) {
            var n = -i + t * Math.log(i) - jstat.lgamma(t + 1);
            return e ? n : Math.exp(n)
        }
        var a = jstat.TWO_PI * t,
            s = -jstat.stirlerr(t) - jstat.bd0(t, i);
        return e ? -.5 * Math.log(a) + s : Math.exp(s) / Math.sqrt(a)
    }, jstat.bd0 = function (t, i) {
        var e, n, a, s, r;
        if (!jstat.isFinite(t) || !jstat.isFinite(i) || 0 == i) throw "illegal parameter in jstat.bd0";
        if (Math.abs(t - i) > .1 * (t + i))
            for (s = (t - i) / (t + i), n = (t - i) * s, e = 2 * t * s, s *= s, r = 1;; r++) {
                if (e *= s, a = n + e / ((r << 1) + 1), a == n) return a;
                n = a
            }
        return t * Math.log(t / i) + i - t
    }, jstat.stirlerr = function (t) {
        var i, e = .08333333333333333,
            n = .002777777777777778,
            a = .0007936507936507937,
            s = .0005952380952380953,
            r = .0008417508417508417,
            o = [0, .15342640972002736, .08106146679532726, .05481412105191765, .0413406959554093, .03316287351993629, .02767792568499834, .023746163656297496, .020790672103765093, .018488450532673187, .016644691189821193, .015134973221917378, .013876128823070748, .012810465242920227, .01189670994589177, .011104559758206917, .010411265261972096, .009799416126158804, .009255462182712733, .008768700134139386, .00833056343336287, .00793411456431402, .007573675487951841, .007244554301320383, .00694284010720953, .006665247032707682, .006408994188004207, .006171712263039458, .0059513701127588475, .0057462165130101155, .005554733551962801];
        return 15 >= t ? (i = t + t, i == parseInt(i) ? o[parseInt(i)] : jstat.lgamma(t + 1) - (t + .5) * Math.log(t) + t - jstat.LN_SQRT_2PI) : (i = t * t, t > 500 ? (e - n / i) / t : t > 80 ? (e - (n - a / i) / i) / t : t > 35 ? (e - (n - (a - s / i) / i) / i) / t : (e - (n - (a - (s - r / i) / i) / i) / i) / t)
    }, jstat.lgamma = function (t) {
        function i(t, i) {
            var e, n, a, s = 2.5327372760800758e305,
                r = 1.4901161193847656e-8;
            if (null != i && (i = 1), isNaN(t)) return t;
            if (0 > t && 0 == Math.floor(-t) % 2 && null != i && (i = -1), 0 >= t && t == jstat.trunc(t)) return console.warn("Negative integer argument in lgammafn_sign"), Number.POSITIVE_INFINITY;
            if (n = Math.abs(t), 10 >= n) return Math.log(Math.abs(jstat.gamma(t)));
            if (n > s) return console.warn("Illegal arguement passed to lgammafn_sign"), Number.POSITIVE_INFINITY;
            if (t > 0) return t > 1e17 ? t * (Math.log(t) - 1) : t > 4934720 ? jstat.LN_SQRT_2PI + (t - .5) * Math.log(t) - t : jstat.LN_SQRT_2PI + (t - .5) * Math.log(t) - t + jstat.lgammacor(t);
            if (a = Math.abs(Math.sin(Math.PI * n)), 0 == a) throw "Should never happen!!";
            if (e = jstat.LN_SQRT_PId2 + (t - .5) * Math.log(n) - t - Math.log(a) - jstat.lgammacor(n), Math.abs((t - jstat.trunc(t - .5)) * e / t) < r) throw "The answer is less than half the precision argument too close to a negative integer";
            return e
        }
        return i(t, null)
    }, jstat.gamma = function (t) {
        var i, e, n, a, s, r, o, l, u, h, f, _, c = 171.624,
            g = [-1.716185138865495, 24.76565080557592, -379.80425647094563, 629.3311553128184, 866.9662027904133, -31451.272968848367, -36144.413418691176, 66456.14382024054],
            m = [-30.840230011973897, 315.35062697960416, -1015.1563674902192, -3107.771671572311, 22538.11842098015, 4755.846277527881, -134659.9598649693, -115132.25967555349],
            p = [-.001910444077728, .00084171387781295, -.0005952379913043012, .0007936507935003503, -.0027777777777776816, .08333333333333333, .0057083835261];
        if (n = 0, a = 1, e = 0, o = t, 0 >= o) {
            if (o = -t, u = jstat.trunc(o), h = o - u, 0 == h) return Number.POSITIVE_INFINITY;
            u != 2 * jstat.trunc(.5 * u) && (n = 1), a = -Math.PI / Math.sin(Math.PI * h), o += 1
        }
        if (o < jstat.DBL_EPSILON) {
            if (!(o >= jstat.DBL_MIN)) return Number.POSITIVE_INFINITY;
            h = 1 / o
        } else if (12 > o) {
            for (u = o, 1 > o ? (l = o, o += 1) : (e = parseInt(o) - 1, o -= parseFloat(e), l = o - 1), r = 0, s = 1, i = 0; 8 > i; ++i) r = (r + g[i]) * l, s = s * l + m[i];
            if (h = r / s + 1, o > u) h /= u;
            else if (u > o)
                for (i = 0; e > i; ++i) h *= o, o += 1
        } else {
            if (!(c >= o)) return Number.POSITIVE_INFINITY;
            for (_ = o * o, f = p[6], i = 0; 6 > i; ++i) f = f / _ + p[i];
            f = f / o - o + jstat.LN_SQRT_2PI, f += (o - .5) * Math.log(o), h = Math.exp(f)
        }
        return n && (h = -h), 1 != a && (h = a / h), h
    }, jstat.lgammacor = function (t) {
        var i, e = [.16663894804518634, -1384948176067564e-20, 9.81082564692473e-9, -1.809129475572494e-11, 6.221098041892606e-14, -3.399615005417722e-16, 2.683181998482699e-18, -2.868042435334643e-20, 3.9628370610464347e-22, -6.831888753985767e-24, 1.4292273559424982e-25, -3.5475981581010704e-27, 1.025680058010471e-28, -3.401102254316749e-30, 1.276642195630063e-31],
            n = 5,
            a = 94906265.62425156,
            s = 3.745194030963158e306;
        if (10 > t) return Number.NaN;
        if (t >= s) throw "Underflow error in lgammacor";
        return a > t ? (i = 10 / t, jstat.chebyshev(2 * i * i - 1, e, n) / t) : 1 / (12 * t)
    }, jstat.incompleteBeta = function (t, i, e) {
        function n(t, i, e) {
            var n, a, s, r, o, l, u, h, f, _, c = 100,
                g = 3e-12,
                m = 1e-30;
            for (h = t + i, _ = t + 1, f = t - 1, r = 1, o = 1 - h * e / _, Math.abs(o) < m && (o = m), o = 1 / o, u = o, n = 1; c >= n && (a = 2 * n, s = n * (i - n) * e / ((f + a) * (t + a)), o = 1 + s * o, Math.abs(o) < m && (o = m), r = 1 + s / r, Math.abs(r) < m && (r = m), o = 1 / o, u *= o * r, s = -(t + n) * (h + n) * e / ((t + a) * (_ + a)), o = 1 + s * o, Math.abs(o) < m && (o = m), r = 1 + s / r, Math.abs(r) < m && (r = m), o = 1 / o, l = o * r, u *= l, !(Math.abs(l - 1) < g)); n++);
            return n > c ? (console.warn("a or b too big, or MAXIT too small in betacf: " + t + ", " + i + ", " + e + ", " + u), u) : (isNaN(u) && console.warn(t + ", " + i + ", " + e), u)
        }
        var a;
        if (0 > e || e > 1) throw "bad x in routine incompleteBeta";
        return a = 0 == e || 1 == e ? 0 : Math.exp(jstat.lgamma(t + i) - jstat.lgamma(t) - jstat.lgamma(i) + t * Math.log(e) + i * Math.log(1 - e)), (t + 1) / (t + i + 2) > e ? a * n(t, i, e) / t : 1 - a * n(i, t, 1 - e) / i
    }, jstat.chebyshev = function (t, i, e) {
        var n, a, s, r, o;
        if (1 > e || e > 1e3) return Number.NaN;
        if (-1.1 > t || t > 1.1) return Number.NaN;
        for (r = 2 * t, s = a = 0, n = 0, o = 1; e >= o; o++) s = a, a = n, n = r * a - s + i[e - o];
        return .5 * (n - s)
    }, jstat.fmin2 = function (t, i) {
        return i > t ? t : i
    }, jstat.log1p = function (t) {
        var i = 0,
            e = 50;
        if (-1 >= t) return Number.NEGATIVE_INFINITY;
        if (0 > t || t > 1) return Math.log(1 + t);
        for (var n = 1; e > n; n++) 0 === n % 2 ? i -= Math.pow(t, n) / n : i += Math.pow(t, n) / n;
        return i
    }, jstat.expm1 = function (t) {
        var i, e = Math.abs(t);
        return e < jstat.DBL_EPSILON ? t : e > .697 ? Math.exp(t) - 1 : (i = e > 1e-8 ? Math.exp(t) - 1 : (t / 2 + 1) * t, i -= (1 + i) * (jstat.log1p(i) - t))
    }, jstat.logBeta = function (t, i) {
        var e, n, a;
        return n = a = t, n > i && (n = i), i > a && (a = i), 0 > n ? (console.warn("Both arguements must be >= 0"), Number.NaN) : 0 == n ? Number.POSITIVE_INFINITY : jstat.isFinite(a) ? n >= 10 ? (e = jstat.lgammacor(n) + jstat.lgammacor(a) - jstat.lgammacor(n + a), Math.log(a) * -.5 + jstat.LN_SQRT_2PI + e + (n - .5) * Math.log(n / (n + a)) + a * jstat.log1p(-n / (n + a))) : a >= 10 ? (e = jstat.lgammacor(a) - jstat.lgammacor(n + a), jstat.lgamma(n) + e + n - n * Math.log(n + a) + (a - .5) * jstat.log1p(-n / (n + a))) : Math.log(jstat.gamma(n) * (jstat.gamma(a) / jstat.gamma(n + a))) : Number.NEGATIVE_INFINITY
    }, jstat.dbinom_raw = function (t, i, e, n, a) {
        null == a && (a = !1);
        var s, r;
        return 0 == e ? 0 == t ? a ? 0 : 1 : a ? Number.NEGATIVE_INFINITY : 0 : 0 == n ? t == i ? a ? 0 : 1 : a ? Number.NEGATIVE_INFINITY : 0 : 0 == t ? 0 == i ? a ? 0 : 1 : (r = .1 > e ? -jstat.bd0(i, i * n) - i * e : i * Math.log(n), a ? r : Math.exp(r)) : t == i ? (r = .1 > n ? -jstat.bd0(i, i * e) - i * n : i * Math.log(e), a ? r : Math.exp(r)) : 0 > t || t > i ? a ? Number.NEGATIVE_INFINITY : 0 : (r = jstat.stirlerr(i) - jstat.stirlerr(t) - jstat.stirlerr(i - t) - jstat.bd0(t, i * e) - jstat.bd0(i - t, i * n), s = Math.log(jstat.TWO_PI) + Math.log(t) + jstat.log1p(-t / i), a ? r - .5 * s : Math.exp(r - .5 * s))
    }, jstat.max = function (t) {
        for (var i = Number.NEGATIVE_INFINITY, e = 0; e < t.length; e++) t[e] > i && (i = t[e]);
        return i
    };
var Range = Class.extend({
    init: function (t, i, e) {
        this._minimum = parseFloat(t), this._maximum = parseFloat(i), this._numPoints = parseFloat(e)
    },
    getMinimum: function () {
        return this._minimum
    },
    getMaximum: function () {
        return this._maximum
    },
    getNumPoints: function () {
        return this._numPoints
    },
    getPoints: function () {
        for (var t = [], i = this._minimum, e = (this._maximum - this._minimum) / (this._numPoints - 1), n = 0; n < this._numPoints; n++) t[n] = parseFloat(i.toFixed(6)), i += e;
        return t
    }
});
Range.validate = function (t) {
    return !t instanceof Range ? !1 : isNaN(t.getMinimum()) || isNaN(t.getMaximum()) || isNaN(t.getNumPoints()) || t.getMaximum() < t.getMinimum() || t.getNumPoints() <= 0 ? !1 : !0
};
var ContinuousDistribution = Class.extend({
        init: function (t) {
            this._name = t
        },
        toString: function () {
            return this._string
        },
        getName: function () {
            return this._name
        },
        getClassName: function () {
            return this._name + "Distribution"
        },
        density: function (t) {
            if (isNaN(t)) {
                if (Range.validate(t)) {
                    for (var i = t.getPoints(), e = [], n = 0; n < i.length; n++) e[n] = parseFloat(this._pdf(i[n]));
                    return e
                }
                throw "Invalid parameter supplied to " + this.getClassName() + ".density()"
            }
            return parseFloat(this._pdf(t).toFixed(15))
        },
        cumulativeDensity: function (t) {
            if (isNaN(t)) {
                if (Range.validate(t)) {
                    for (var i = t.getPoints(), e = [], n = 0; n < i.length; n++) e[n] = parseFloat(this._cdf(i[n]));
                    return e
                }
                throw "Invalid parameter supplied to " + this.getClassName() + ".cumulativeDensity()"
            }
            return parseFloat(this._cdf(t).toFixed(15))
        },
        getRange: function (t, i) {
            null == t && (t = 5), null == i && (i = 100);
            var e = this.getMean() - t * Math.sqrt(this.getVariance()),
                n = this.getMean() + t * Math.sqrt(this.getVariance());
            "GammaDistribution" == this.getClassName() || "LogNormalDistribution" == this.getClassName() ? (e = 0, n = this.getMean() + t * Math.sqrt(this.getVariance())) : "BetaDistribution" == this.getClassName() && (e = 0, n = 1);
            var a = new Range(e, n, i);
            return a
        },
        getVariance: function () {},
        getMean: function () {},
        getQuantile: function (t) {
            function i(t, n) {
                for (var a = 1e-5, s = t.getPoints(), r = 0, o = 999, l = 0; l < s.length; l++) {
                    var u = e.cumulativeDensity(s[l]),
                        h = Math.abs(u - n);
                    o > h && (r = l, o = h)
                }
                if (a >= o) return s[r];
                var f = new Range(s[r - 1], s[r + 1], 20);
                return i(f, n)
            }
            var e = this,
                n = this.getRange(5, 20);
            return i(n, t)
        }
    }),
    NormalDistribution = ContinuousDistribution.extend({
        init: function (t, i) {
            this._super("Normal"), this._mean = parseFloat(t), this._sigma = parseFloat(i), this._string = "Normal (" + this._mean.toFixed(2) + ", " + this._sigma.toFixed(2) + ")"
        },
        _pdf: function (t, i) {
            null == i && (i = !1);
            var e = this._sigma,
                n = this._mean;
            if (!jstat.isFinite(e)) return i ? Number.NEGATIVE_INFINITY : 0;
            if (!jstat.isFinite(t) && n == t) return Number.NaN;
            if (0 >= e) {
                if (0 > e) throw "invalid sigma in _pdf";
                return t == n ? Number.POSITIVE_INFINITY : i ? Number.NEGATIVE_INFINITY : 0
            }
            return t = (t - n) / e, jstat.isFinite(t) ? i ? -(jstat.LN_SQRT_2PI + .5 * t * t + Math.log(e)) : jstat.ONE_SQRT_2PI * Math.exp(-.5 * t * t) / e : i ? Number.NEGATIVE_INFINITY : 0
        },
        _cdf: function (t, i, e) {
            function n(t, i, e, n, a) {
                var s, r, o, l, u, h, f, _, c, g, m = [2.2352520354606837, 161.02823106855587, 1067.6894854603709, 18154.98125334356, .06568233791820745],
                    p = [47.202581904688245, 976.0985517377767, 10260.932208618979, 45507.78933502673],
                    d = [.39894151208813466, 8.883149794388377, 93.50665613217785, 597.2702763948002, 2494.5375852903726, 6848.190450536283, 11602.65143764735, 9842.714838383978, 1.0765576773720192e-8],
                    N = [22.266688044328117, 235.387901782625, 1519.3775994075547, 6485.558298266761, 18615.571640885097, 34900.95272114598, 38912.00328609327, 19685.429676859992],
                    b = [.215898534057957, .12740116116024736, .022235277870649807, .0014216191932278934, 29112874951168793e-21, .023073441764940174],
                    I = [1.284260096144911, .4682382124808651, .06598813786892856, .0037823963320275824, 7297515550839662e-20];
                if (u = .5 * jstat.DBL_EPSILON, c = 1 != n, g = 0 != n, f = Math.abs(t), .67448975 >= f) {
                    if (f > u)
                        for (h = t * t, r = m[4] * h, s = h, _ = 0; 3 > _; ++_) r = (r + m[_]) * h, s = (s + p[_]) * h;
                    else r = s = 0;
                    o = t * (r + m[3]) / (s + p[3]), c && (i = .5 + o), g && (e = .5 - o), a && (c && (i = Math.log(i)), g && (e = Math.log(e)))
                } else if (f <= jstat.SQRT_32) {
                    for (r = d[8] * f, s = f, _ = 0; 7 > _; ++_) r = (r + d[_]) * f, s = (s + N[_]) * f;
                    o = (r + d[7]) / (s + N[7]), h = jstat.trunc(16 * t) / 16, l = (t - h) * (t + h), a ? (i = .5 * -h * h + .5 * -l + Math.log(o), (c && t > 0 || g && 0 >= t) && (e = jstat.log1p(-Math.exp(.5 * -h * h) * Math.exp(.5 * -l) * o))) : (i = Math.exp(.5 * -h * h) * Math.exp(.5 * -l) * o, e = 1 - i), t > 0 && (o = i, c && (i = e), e = o)
                } else if (a && 1e170 > f || c && t > -37.5193 && 8.2924 > t || g && t > -8.2924 && 37.5193 > t) {
                    for (h = 1 / (t * t), r = b[5] * h, s = h, _ = 0; 4 > _; ++_) r = (r + b[_]) * h, s = (s + I[_]) * h;
                    o = h * (r + b[4]) / (s + I[4]), o = (jstat.ONE_SQRT_2PI - o) / f, h = jstat.trunc(16 * t) / 16, l = (t - h) * (t + h), a ? (i = .5 * -h * h + .5 * -l + Math.log(o), (c && t > 0 || g && 0 >= t) && (e = jstat.log1p(-Math.exp(.5 * -h * h) * Math.exp(.5 * -l) * o))) : (i = Math.exp(.5 * -h * h) * Math.exp(.5 * -l) * o, e = 1 - i), t > 0 && (o = i, c && (i = e), e = o)
                } else t > 0 ? (i = a ? 0 : 1, e = a ? Number.NEGATIVE_INFINITY : 0) : (i = a ? Number.NEGATIVE_INFINITY : 0, e = a ? 0 : 1);
                return [i, e]
            }
            null == i && (i = !0), null == e && (e = !1);
            var a, s, r, o, l = this._mean,
                u = this._sigma;
            if (i ? e ? (r = Number.NEGATIVE_INFINITY, o = 0) : (r = 0, o = 1) : e ? (r = 0, o = Number.NEGATIVE_INFINITY) : (r = 1, o = 0), !jstat.isFinite(t) && l == t) return Number.NaN;
            if (0 >= u) return 0 > u ? (console.warn("Sigma is less than 0"), Number.NaN) : l > t ? r : o;
            if (a = (t - l) / u, !jstat.isFinite(a)) return l > t ? r : o;
            t = a;
            var h = n(t, a, s, i ? !1 : !0, e);
            return i ? h[0] : h[1]
        },
        getMean: function () {
            return this._mean
        },
        getSigma: function () {
            return this._sigma
        },
        getVariance: function () {
            return this._sigma * this._sigma
        }
    }),
    LogNormalDistribution = ContinuousDistribution.extend({
        init: function (t, i) {
            this._super("LogNormal"), this._location = parseFloat(t), this._scale = parseFloat(i), this._string = "LogNormal (" + this._location.toFixed(2) + ", " + this._scale.toFixed(2) + ")"
        },
        _pdf: function (t, i) {
            var e, n = this._scale,
                a = this._location;
            if (null == i && (i = !1), 0 >= n) throw "Illegal parameter in _pdf";
            return 0 >= t ? i ? Number.NEGATIVE_INFINITY : 0 : (e = (Math.log(t) - a) / n, i ? -(jstat.LN_SQRT_2PI + .5 * e * e + Math.log(t * n)) : jstat.ONE_SQRT_2PI * Math.exp(-.5 * e * e) / (t * n))
        },
        _cdf: function (t, i, e) {
            var n = this._scale,
                a = this._location;
            if (null == i && (i = !0), null == e && (e = !1), 0 >= n) throw "illegal std in _cdf";
            if (t > 0) {
                var s = new NormalDistribution(a, n);
                return s._cdf(Math.log(t), i, e)
            }
            return i ? e ? Number.NEGATIVE_INFINITY : 0 : e ? 0 : 1
        },
        getLocation: function () {
            return this._location
        },
        getScale: function () {
            return this._scale
        },
        getMean: function () {
            return Math.exp((this._location + this._scale) / 2)
        },
        getVariance: function () {
            var t = (Math.exp(this._scale) - 1) * Math.exp(2 * this._location + this._scale);
            return t
        }
    }),
    GammaDistribution = ContinuousDistribution.extend({
        init: function (t, i) {
            this._super("Gamma"), this._shape = parseFloat(t), this._scale = parseFloat(i), this._string = "Gamma (" + this._shape.toFixed(2) + ", " + this._scale.toFixed(2) + ")"
        },
        _pdf: function (t, i) {
            var e, n = this._shape,
                a = this._scale;
            if (null == i && (i = !1), 0 > n || 0 >= a) throw "Illegal argument in _pdf";
            return 0 > t ? i ? Number.NEGATIVE_INFINITY : 0 : 0 == n ? 0 == t ? Number.POSITIVE_INFINITY : i ? Number.NEGATIVE_INFINITY : 0 : 0 == t ? 1 > n ? Number.POSITIVE_INFINITY : n > 1 ? i ? Number.NEGATIVE_INFINITY : 0 : i ? -Math.log(a) : 1 / a : 1 > n ? (e = jstat.dopois_raw(n, t / a, i), i ? e + Math.log(n / t) : e * n / t) : (e = jstat.dopois_raw(n - 1, t / a, i), i ? e - Math.log(a) : e / a)
        },
        _cdf: function (t, i, e) {
            function n() {
                a = 3 * Math.sqrt(b) * (Math.pow(t / b, 1 / 3) + 1 / (9 * b) - 1);
                var n = new NormalDistribution(0, 1);
                return n._cdf(a, i, e)
            }
            null == i && (i = !0), null == e && (e = !1);
            var a, s, r, o, l, u, h, f, _, c, g, m, p, d, N, b = this._shape,
                I = this._scale,
                v = 1e8,
                w = 1e37,
                M = 1e5;
            if (0 >= b || 0 >= I) return console.warn("Invalid gamma params in _cdf"), Number.NaN;
            if (t /= I, isNaN(t)) return t;
            if (0 >= t) return i ? e ? Number.NEGATIVE_INFINITY : 0 : e ? 0 : 1;
            if (b > M) return n();
            if (t > v * b) return t > jstat.DBL_MAX * b ? i ? e ? 0 : 1 : e ? Number.NEGATIVE_INFINITY : 0 : n();
            if (1 >= t || b > t) {
                N = 1, h = b * Math.log(t) - t - jstat.lgamma(b + 1), c = 1, p = 1, f = b;
                do f += 1, c *= t / f, p += c; while (c > jstat.DBL_EPSILON * p)
            } else
                for (N = 0, h = b * Math.log(t) - t - jstat.lgamma(b), f = 1 - b, _ = f + t + 1, a = 1, s = t, r = t + 1, o = t * _, p = r / o, d = 1; f += 1, _ += 2, g = f * d, l = _ * r - g * a, u = _ * o - g * s, !(Math.abs(u) > 0 && (m = p, p = l / u, Math.abs(m - p) <= jstat.DBL_EPSILON * jstat.fmin2(1, p))); d++) a = r, s = o, r = l, o = u, Math.abs(l) >= w && (a /= w, s /= w, r /= w, o /= w);
            return h += Math.log(p), i = i == N, e && i ? h : i ? Math.exp(h) : e ? h > -Math.LN2 ? Math.log(-jstat.expm1(h)) : jstat.log1p(-Math.exp(h)) : -jstat.expm1(h)
        },
        getShape: function () {
            return this._shape
        },
        getScale: function () {
            return this._scale
        },
        getMean: function () {
            return this._shape * this._scale
        },
        getVariance: function () {
            return this._shape * Math.pow(this._scale, 2)
        }
    }),
    BetaDistribution = ContinuousDistribution.extend({
        init: function (t, i) {
            this._super("Beta"), this._alpha = parseFloat(t), this._beta = parseFloat(i), this._string = "Beta (" + this._alpha.toFixed(2) + ", " + this._beta.toFixed(2) + ")"
        },
        _pdf: function (t, i) {
            null == i && (i = !1);
            var e, n = this._alpha,
                a = this._beta;
            return 0 >= n || 0 >= a ? (console.warn("Illegal arguments in _pdf"), Number.NaN) : 0 > t || t > 1 ? i ? Number.NEGATIVE_INFINITY : 0 : 0 == t ? n > 1 ? i ? Number.NEGATIVE_INFINITY : 0 : 1 > n ? Number.POSITIVE_INFINITY : i ? Math.log(a) : a : 1 == t ? a > 1 ? i ? Number.NEGATIVE_INFINITY : 0 : 1 > a ? Number.POSITIVE_INFINITY : i ? Math.log(n) : n : (e = 2 >= n || 2 >= a ? (n - 1) * Math.log(t) + (a - 1) * jstat.log1p(-t) - jstat.logBeta(n, a) : Math.log(n + a - 1) + jstat.dbinom_raw(n - 1, n + a - 2, t, 1 - t, !0), i ? e : Math.exp(e))
        },
        _cdf: function (t, i, e) {
            null == i && (i = !0), null == e && (e = !1);
            var n = this._alpha,
                a = this._beta;
            return 0 >= n || 0 >= a ? (console.warn("Invalid argument in _cdf"), Number.NaN) : 0 >= t ? i ? e ? Number.NEGATIVE_INFINITY : 0 : e ? .1 : 1 : t >= 1 ? i ? e ? .1 : 1 : e ? Number.NEGATIVE_INFINITY : 0 : jstat.incompleteBeta(n, a, t)
        },
        getAlpha: function () {
            return this._alpha
        },
        getBeta: function () {
            return this._beta
        },
        getMean: function () {
            return this._alpha / (this._alpha + this._beta)
        },
        getVariance: function () {
            var t = this._alpha * this._beta / (Math.pow(this._alpha + this._beta, 2) * (this._alpha + this._beta + 1));
            return t
        }
    }),
    StudentTDistribution = ContinuousDistribution.extend({
        init: function (t, i) {
            this._super("StudentT"), this._dof = parseFloat(t), null != i ? (this._mu = parseFloat(i), this._string = "StudentT (" + this._dof.toFixed(2) + ", " + this._mu.toFixed(2) + ")") : (this._mu = 0, this._string = "StudentT (" + this._dof.toFixed(2) + ")")
        },
        _pdf: function (t, i) {
            if (null == i && (i = !1), null == this._mu) return this._dt(t, i);
            var e = this._dnt(t, i);
            return e > 1 && console.warn("x:" + t + ", y: " + e), e
        },
        _cdf: function (t, i, e) {
            return null == i && (i = !0), null == e && (e = !1), null == this._mu ? this._pt(t, i, e) : this._pnt(t, i, e)
        },
        _dt: function (t, i) {
            var e, n, a = this._dof;
            if (0 >= a) return console.warn("Invalid parameters in _dt"), Number.NaN;
            if (!jstat.isFinite(t)) return i ? Number.NEGATIVE_INFINITY : 0;
            if (!jstat.isFinite(a)) {
                var s = new NormalDistribution(0, 1);
                return s.density(t, i)
            }
            e = -jstat.bd0(a / 2, (a + 1) / 2) + jstat.stirlerr((a + 1) / 2) - jstat.stirlerr(a / 2), n = t * t > .2 * a ? Math.log(1 + t * t / a) * a / 2 : -jstat.bd0(a / 2, (a + t * t) / 2) + t * t / 2;
            var r = jstat.TWO_PI * (1 + t * t / a),
                o = e - n;
            return i ? -.5 * Math.log(r) + o : Math.exp(o) / Math.sqrt(r)
        },
        _dnt: function (t, i) {
            null == i && (i = !1);
            var e, n = this._dof,
                a = this._mu;
            if (0 >= n) return console.warn("Illegal arguments _dnf"), Number.NaN;
            if (0 == a) return this._dt(t, i);
            if (!jstat.isFinite(t)) return i ? Number.NEGATIVE_INFINITY : 0;
            if (!isFinite(n) || n > 1e8) {
                var s = new NormalDistribution(a, 1);
                return s.density(t, i)
            }
            if (Math.abs(t) > Math.sqrt(n * jstat.DBL_EPSILON)) {
                var r = new StudentTDistribution(n + 2, a);
                e = Math.log(n) - Math.log(Math.abs(t)) + Math.log(Math.abs(r._pnt(t * Math.sqrt((n + 2) / n), !0, !1) - this._pnt(t, !0, !1)))
            } else e = jstat.lgamma((n + 1) / 2) - jstat.lgamma(n / 2) - .5 * (Math.log(Math.PI) + Math.log(n) + a * a);
            return i ? e : Math.exp(e)
        },
        _pt: function (t, i, e) {
            null == i && (i = !0), null == e && (e = !1);
            var n, a, s, r, o = this._dof;
            if (i ? e ? (s = Number.NEGATIVE_INFINITY, r = 1) : (s = 0, r = 1) : e ? (s = 0, r = Number.NEGATIVE_INFINITY) : (s = 1, r = 0), 0 >= o) return console.warn("Invalid T distribution _pt"), Number.NaN;
            var l = new NormalDistribution(0, 1);
            if (!jstat.isFinite(t)) return 0 > t ? s : r;
            if (!jstat.isFinite(o)) return l._cdf(t, i, e);
            if (o > 4e5) return n = 1 / (4 * o), l._cdf(t * (1 - n) / sqrt(1 + 2 * t * t * n), i, e);
            if (a = 1 + t / o * t, !(a > 1e100)) {
                if (o > t * t) {
                    var u = new BetaDistribution(.5, o / 2);
                    return u._cdf(t * t / (o + t * t), !1, e)
                }
                return u = new BetaDistribution(o / 2, .5), u._cdf(1 / a, !0, e)
            }
            var h;
            return h = -.5 * o * (2 * Math.log(Math.abs(t)) - Math.log(o)) - jstat.logBeta(.5 * o, .5) - Math.log(.5 * o), n = e ? h : Math.exp(h), 0 >= t && (i = !i), e ? i ? jstat.log1p(-.5 * Math.exp(n)) : n - M_LN2 : (n /= 2, i ? .5 - n + .5 : n)
        },
        _pnt: function (t, i, e) {
            var n, a, s = this._dof,
                r = this._mu;
            i ? e ? (n = Number.NEGATIVE_INFINITY, a = 1) : (n = 0, a = 1) : e ? (n = 0, a = Number.NEGATIVE_INFINITY) : (n = 1, a = 0);
            var o, l, u, h, f, _, c, g, m, p, d, N, b, I, v, w, M, j, T, x = 1e3,
                $ = 1e-7;
            if (0 >= s) return Number.NaN;
            if (0 == s) return this._pt(t);
            if (!jstat.isFinite(t)) return 0 > t ? n : a;
            if (t >= 0) T = !1, g = t, h = r;
            else {
                if (r >= 40 && (!e || !i)) return n;
                T = !0, g = -t, h = -r
            } if (s > 4e5 || h * h > 2 * Math.LN2 * -jstat.DBL_MIN_EXP) {
                I = 1 / (4 * s);
                var F = new NormalDistribution(h, Math.sqrt(1 + 2 * g * g * I)),
                    D = F._cdf(g * (1 - I), i != T, e);
                return D
            }
            if (m = t * t, c = s / (m + s), m /= m + s, m > 0) {
                if (_ = h * h, N = .5 * Math.exp(-.5 * _), 0 == N) return console.warn("underflow in _pnt"), n;
                for (b = jstat.SQRT_2dPI * N * h, I = .5 - N, 1e-7 > I && (I = -.5 * jstat.expm1(-.5 * _)), l = .5, u = .5 * s, c = Math.pow(c, u), o = jstat.LN_SQRT_PI + jstat.lgamma(u) - jstat.lgamma(.5 + u), M = jstat.incompleteBeta(l, u, m), d = 2 * c * Math.exp(l * Math.log(m) - o), v = u * m, w = v < jstat.DBL_EPSILON ? v : 1 - c, p = v * c, v = N * M + b * w, j = 1; x >= j && (l += 1, M -= d, w -= p, d *= m * (l + u - 1) / l, p *= m * (l + u - .5) / (l + .5), N *= _ / (2 * j), b *= _ / (2 * j + 1), v += N * M + b * w, I -= N, !(-1e-10 > I)) && !(0 >= I && j > 1) && (f = 2 * I * (M - d), !(Math.abs(f) < $)); j++);
                if (j == x) throw "Non-convergence _pnt"
            } else v = 0;
            F = new NormalDistribution(0, 1), v += F._cdf(-h, !0, !1), i = i != T;
            var E = jstat.fmin2(v, 1);
            return i ? e ? Math.log(E) : E : e ? jstat.log1p(-E) : .5 - E + .5
        },
        getDegreesOfFreedom: function () {
            return this._dof
        },
        getNonCentralityParameter: function () {
            return this._mu
        },
        getMean: function () {
            if (this._dof > 1) {
                var t = .5 * Math.log(this._dof / 2) + jstat.lgamma((this._dof - 1) / 2) - jstat.lgamma(this._dof / 2);
                return Math.exp(t) * this._mu
            }
            return Number.NaN
        },
        getVariance: function () {
            if (this._dof > 2) {
                var t = this._dof * (1 + this._mu * this._mu) / (this._dof - 2) - this._mu * this._mu * this._dof / 2 * Math.pow(Math.exp(jstat.lgamma((this._dof - 1) / 2) - jstat.lgamma(this._dof / 2)), 2);
                return t
            }
            return Number.NaN
        }
    }),
    Plot = Class.extend({
        init: function (t, i) {
            this._container = "#" + String(t), this._plots = [], this._flotObj = null, this._locked = !1, this._options = null != i ? i : {}
        },
        getContainer: function () {
            return this._container
        },
        getGraph: function () {
            return this._flotObj
        },
        setData: function (t) {
            this._plots = t
        },
        clear: function () {
            this._plots = []
        },
        showLegend: function () {
            this._options.legend = {
                show: !0
            }, this.render()
        },
        hideLegend: function () {
            this._options.legend = {
                show: !1
            }, this.render()
        },
        render: function () {
            this._flotObj = null, this._flotObj = $.plot($(this._container), this._plots, this._options)
        }
    }),
    DistributionPlot = Plot.extend({
        init: function (t, i, e, n) {
            this._super(t, n), this._showPDF = !0, this._showCDF = !1, this._pdfValues = [], this._cdfValues = [], this._maxY = 1, this._plotType = "line", this._fill = !1, this._distribution = i, this._range = null != e && Range.validate(e) ? e : this._distribution.getRange(), null != this._distribution ? this._maxY = this._generateValues() : (this._options.xaxis = {
                min: e.getMinimum(),
                max: e.getMaximum()
            }, this._options.yaxis = {
                max: 1
            }), this.render()
        },
        setHover: function (t) {
            function i(t, i, e, n) {
                $('<div id="jstat_tooltip">' + e + "</div>").css({
                    position: "absolute",
                    display: "none",
                    top: i + 15,
                    "font-size": "small",
                    left: t + 5,
                    border: "1px solid " + n[1],
                    color: n[2],
                    padding: "5px",
                    "background-color": n[0],
                    opacity: .8
                }).appendTo("body").show()
            }
            if (t) {
                null == this._options.grid ? this._options.grid = {
                    hoverable: !0,
                    mouseActiveRadius: 25
                } : (this._options.grid.hoverable = !0, this._options.grid.mouseActiveRadius = 25);
                var e = null;
                $(this._container).bind("plothover", function (t, n, a) {
                    if ($("#x").text(n.x.toFixed(2)), $("#y").text(n.y.toFixed(2)), a) {
                        if (e != a.datapoint) {
                            e = a.datapoint, $("#jstat_tooltip").remove();
                            var s = jstat.toSigFig(a.datapoint[0], 2),
                                r = jstat.toSigFig(a.datapoint[1], 2),
                                o = null,
                                l = a.series.color;
                            "PDF" == a.series.label ? (o = "P(" + s + ") = " + r, l = ["#fee", "#fdd", "#C05F5F"]) : (o = "F(" + s + ") = " + r, l = ["#eef", "#ddf", "#4A4AC0"]), i(a.pageX, a.pageY, o, l)
                        }
                    } else $("#jstat_tooltip").remove(), e = null
                }), $(this._container).bind("mouseleave", function () {
                    $("#jstat_tooltip").is(":visible") && ($("#jstat_tooltip").remove(), e = null)
                })
            } else null == this._options.grid ? this._options.grid = {
                hoverable: !1
            } : this._options.grid.hoverable = !1, $(this._container).unbind("plothover");
            this.render()
        },
        setType: function (t) {
            this._plotType = t;
            var i = {},
                e = {};
            "line" == this._plotType ? (i.show = !0, e.show = !1) : "points" == this._plotType ? (i.show = !1, e.show = !0) : "both" == this._plotType && (i.show = !0, e.show = !0), null == this._options.series ? this._options.series = {
                lines: i,
                points: e
            } : (null == this._options.series.lines ? this._options.series.lines = i : this._options.series.lines.show = i.show, null == this._options.series.points ? this._options.series.points = e : this._options.series.points.show = e.show), this.render()
        },
        setFill: function (t) {
            this._fill = t, null == this._options.series ? this._options.series = {
                lines: {
                    fill: t
                }
            } : null == this._options.series.lines ? this._options.series.lines = {
                fill: t
            } : this._options.series.lines.fill = t, this.render()
        },
        clear: function () {
            this._super(), this._distribution = null, this._pdfValues = [], this._cdfValues = [], this.render()
        },
        _generateValues: function () {
            this._cdfValues = [], this._pdfValues = [];
            var t = this._range.getPoints();
            this._options.xaxis = {
                min: t[0],
                max: t[t.length - 1]
            };
            for (var i = this._distribution.density(this._range), e = this._distribution.cumulativeDensity(this._range), n = 0; n < t.length; n++)(i[n] == Number.POSITIVE_INFINITY || i[n] == Number.NEGATIVE_INFINITY) && (i[n] = null), (e[n] == Number.POSITIVE_INFINITY || e[n] == Number.NEGATIVE_INFINITY) && (e[n] = null), this._pdfValues.push([t[n], i[n]]), this._cdfValues.push([t[n], e[n]]);
            return jstat.max(i)
        },
        showPDF: function () {
            this._showPDF = !0, this.render()
        },
        hidePDF: function () {
            this._showPDF = !1, this.render()
        },
        showCDF: function () {
            this._showCDF = !0, this.render()
        },
        hideCDF: function () {
            this._showCDF = !1, this.render()
        },
        setDistribution: function (t, i) {
            this._distribution = t, this._range = null != i ? i : t.getRange(), this._maxY = this._generateValues(), this._options.yaxis = {
                max: 1.1 * this._maxY
            }, this.render()
        },
        getDistribution: function () {
            return this._distribution
        },
        getRange: function () {
            return this._range
        },
        setRange: function (t) {
            this._range = t, this._generateValues(), this.render()
        },
        render: function () {
            null != this._distribution ? this._showPDF && this._showCDF ? (this.setData([{
                yaxis: 1,
                data: this._pdfValues,
                color: "rgb(237,194,64)",
                clickable: !1,
                hoverable: !0,
                label: "PDF"
            }, {
                yaxis: 2,
                data: this._cdfValues,
                clickable: !1,
                color: "rgb(175,216,248)",
                hoverable: !0,
                label: "CDF"
            }]), this._options.yaxis = {
                max: 1.1 * this._maxY
            }) : this._showPDF ? (this.setData([{
                data: this._pdfValues,
                hoverable: !0,
                color: "rgb(237,194,64)",
                clickable: !1,
                label: "PDF"
            }]), this._options.yaxis = {
                max: 1.1 * this._maxY
            }) : this._showCDF && (this.setData([{
                data: this._cdfValues,
                hoverable: !0,
                color: "rgb(175,216,248)",
                clickable: !1,
                label: "CDF"
            }]), this._options.yaxis = {
                max: 1.1
            }) : this.setData([]), this._super()
        }
    }),
    DistributionFactory = {};
DistributionFactory.build = function (t) {
    if (t.NormalDistribution) {
        if (null != t.NormalDistribution.mean && null != t.NormalDistribution.standardDeviation) return new NormalDistribution(t.NormalDistribution.mean[0], t.NormalDistribution.standardDeviation[0]);
        throw "Malformed JSON provided to DistributionBuilder " + t
    }
    if (t.LogNormalDistribution) {
        if (null != t.LogNormalDistribution.location && null != t.LogNormalDistribution.scale) return new LogNormalDistribution(t.LogNormalDistribution.location[0], t.LogNormalDistribution.scale[0]);
        throw "Malformed JSON provided to DistributionBuilder " + t
    }
    if (t.BetaDistribution) {
        if (null != t.BetaDistribution.alpha && null != t.BetaDistribution.beta) return new BetaDistribution(t.BetaDistribution.alpha[0], t.BetaDistribution.beta[0]);
        throw "Malformed JSON provided to DistributionBuilder " + t
    }
    if (t.GammaDistribution) {
        if (null != t.GammaDistribution.shape && null != t.GammaDistribution.scale) return new GammaDistribution(t.GammaDistribution.shape[0], t.GammaDistribution.scale[0]);
        throw "Malformed JSON provided to DistributionBuilder " + t
    }
    if (t.StudentTDistribution) {
        if (null != t.StudentTDistribution.degreesOfFreedom && null != t.StudentTDistribution.nonCentralityParameter) return new StudentTDistribution(t.StudentTDistribution.degreesOfFreedom[0], t.StudentTDistribution.nonCentralityParameter[0]);
        if (null != t.StudentTDistribution.degreesOfFreedom) return new StudentTDistribution(t.StudentTDistribution.degreesOfFreedom[0]);
        throw "Malformed JSON provided to DistributionBuilder " + t
    }
    throw "Malformed JSON provided to DistributionBuilder " + t
}, $(function () {
    $(".text").focus(function () {
        $(this).parent().find("label").addClass("focused")
    }), $(".text").keyup(function (t) {
        var i = t.keyCode || t.which;
        "" == $(this).val() ? $(this).parent().find("label").fadeIn("fast") : 9 != i && 13 != i && $(this).parent().find("label").fadeOut("fast"), $(this).parent().find(".exclaim") && ($(this).parent().find(".exclaim").fadeOut("fast"), $(this).removeClass("error"))
    }), $(".text").blur(function () {
        "" == $(this).val() && $(this).parent().find("label").removeClass("focused")
    }), submit_mailchimp_form(), $(".soon a").click(function (t) {
        t.preventDefault()
    })
}), $(function () {
    var t = "c";
    $(":text").keyup(function () {
        var t = calculate_conversion("a"),
            i = calculate_conversion("b"),
            e = calculate_certainty(t, i),
            n = determine_statistical_significance(e),
            a = determine_winner(t, i, e),
            s = determine_loser(a),
            r = calculate_winner_improvement(t, i, a);
        $("#a_conversion").text(Math.round(t) + "%"), $("#b_conversion").text(Math.round(i) + "%"), $("#certainty").text(Math.round(e) + "%"), $("#winner").text(a), $("#winner_2").text(a), $("#loser").text(s), $("#loser_2").text(s), $("#winner_improvement").text(Math.round(r) + "%"), $("#stat_sig").text(n)
    }), $("#add_row").click(function (i) {
        i.preventDefault(), t = add_row(t)
    }), submit_mailchimp_form()
}), $(function () {
    $("html").click(function () {
        $(".info").each(function () {
            $(this).remove()
        })
    });
    var t = !1;
    $(document).ready(function () {
        $(".info_icon").hover(function () {
            t = !0
        }, function () {
            t = !1
        }), $("body").mouseup(function () {
            t || $(".info").remove()
        })
    }), $(".info_icon").each(function () {
        $(this).toggle(function () {
            $(".info, .input_error").remove(), "rev_conv_info" == $(this).attr("id") ? $(this).parent().append('<span class="info">This value is what you measured to be the average revenue per converted user.</span>') : "rev_uniques_info" == $(this).attr("id") ? $(this).parent().append('<span class="info">Use <a href="http://kissmetrics.com">KISSmetrics</a> to easily calculate your monthly uniques.</span>') : "biz_type_info" == $(this).attr("id") ? $(this).parent().append('<span class="info">What most closely resembles your business model? Unfortunately we only support these options due to data limitations.</span>') : "rank_net_conv_info" == $(this).attr("id") ? attach_net_conv_info_for_rank($(this).parent()) : "rev_net_conv_info" == $(this).attr("id") && $(this).parent().append('<span class="info">Not sure what this is? Try <a href="http://kissmetrics.com">KISSmetrics</a> to calculate your signup conversion.</span>')
        }, function () {
            $(".info").hide().fadeOut("fast")
        })
    }), $(".inside_label").focus(function () {
        $(this).parent().find("label").addClass("focused")
    }), $(".inside_label").keyup(function (t) {
        var i = t.keyCode || t.which;
        "" == $(this).val() ? $(this).parent().find("label").fadeIn("fast") : 9 != i && 13 != i && $(this).parent().find("label").fadeOut("fast"), $(this).parent().find(".exclaim") && ($(this).parent().find(".exclaim").fadeOut("fast"), $(this).removeClass("error"))
    }), $(".inside_label").blur(function () {
        "" == $(this).val() && $(this).parent().find("label").removeClass("focused")
    }), $(".popup").click(function () {
        var t = 575,
            i = 400,
            e = ($(window).width() - t) / 2,
            n = ($(window).height() - i) / 2,
            a = this.href,
            s = "status=1,width=" + t + ",height=" + i + ",top=" + n + ",left=" + e;
        return window.open(a, "twitter", s), !1
    })
});

