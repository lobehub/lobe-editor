/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';
function t(t, ...e) {
  const n = new URL('https://lexical.dev/docs/error'),
    r = new URLSearchParams();
  r.append('code', t);
  for (const t of e) r.append('v', t);
  throw (
    (n.search = r.toString()),
    Error(
      `Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`,
    )
  );
}
function e(t, ...e) {
  const n = new URL('https://lexical.dev/docs/error'),
    r = new URLSearchParams();
  r.append('code', t);
  for (const t of e) r.append('v', t);
  ((n.search = r.toString()),
    console.warn(
      `Minified Lexical warning #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`,
    ));
}
const n =
    'undefined' != typeof window &&
    void 0 !== window.document &&
    void 0 !== window.document.createElement,
  r = n && 'documentMode' in document ? document.documentMode : null,
  o = n && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
  i = n && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent),
  s =
    !(!n || !('InputEvent' in window) || r) && 'getTargetRanges' in new window.InputEvent('input'),
  l = n && /Version\/[\d.]+.*Safari/.test(navigator.userAgent),
  c = n && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  a = n && /Android/.test(navigator.userAgent),
  u = n && /^(?=.*Chrome).*/i.test(navigator.userAgent),
  f = n && a && u,
  d = n && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && o && !u;
function h(...t) {
  const e = [];
  for (const n of t) if (n && 'string' == typeof n) for (const [t] of n.matchAll(/\S+/g)) e.push(t);
  return e;
}
const g = 0,
  _ = 1,
  p = 2,
  y = 128,
  m = 1,
  x = 2,
  C = 3,
  S = 4,
  N = 5,
  T = 6,
  v = l || c || d ? ' ' : '​',
  k = '\n\n',
  E = i ? ' ' : v,
  O = '֑-߿יִ-﷽ﹰ-ﻼ',
  b = 'A-Za-zÀ-ÖØ-öø-ʸ̀-֐ࠀ-῿‎Ⰰ-﬜︀-﹯﻽-￿',
  M = new RegExp('^[^' + b + ']*[' + O + ']'),
  A = new RegExp('^[^' + O + ']*[' + b + ']'),
  w = {
    bold: 1,
    capitalize: 1024,
    code: 16,
    highlight: y,
    italic: 2,
    lowercase: 256,
    strikethrough: 4,
    subscript: 32,
    superscript: 64,
    underline: 8,
    uppercase: 512,
  },
  D = { directionless: 1, unmergeable: 2 },
  P = { center: 2, end: 6, justify: 4, left: 1, right: 3, start: 5 },
  I = { [x]: 'center', [T]: 'end', [S]: 'justify', [m]: 'left', [C]: 'right', [N]: 'start' },
  L = { normal: 0, segmented: 2, token: 1 },
  F = { [g]: 'normal', [p]: 'segmented', [_]: 'token' },
  R = '$config';
function K(t, e, n, r, o, i) {
  let s = t.getFirstChild();
  for (; null !== s; ) {
    const t = s.__key;
    (s.__parent === e && (co(s) && K(s, t, n, r, o, i), n.has(t) || i.delete(t), o.push(t)),
      (s = s.getNextSibling()));
  }
}
let B = !1,
  z = 0;
function W(t) {
  z = t.timeStamp;
}
function $(t, e, n) {
  const r = 'BR' === t.nodeName,
    o = e.__lexicalLineBreak;
  return (o && (t === o || (r && t.previousSibling === o))) || (r && void 0 !== Zo(t, n));
}
function U(t, e, n) {
  const r = Ji(Li(n));
  let o = null,
    i = null;
  null !== r && r.anchorNode === t && ((o = r.anchorOffset), (i = r.focusOffset));
  const s = t.nodeValue;
  null !== s && di(e, s, o, i, !1);
}
function J(t, e, n) {
  if (ar(t)) {
    const e = t.anchor.getNode();
    if (e.is(n) && t.format !== e.getFormat()) return !1;
  }
  return $o(e) && n.isAttached();
}
function Y(t, e, n, r) {
  for (let o = t; o && !os(o); o = Mi(o)) {
    const t = Zo(o, e);
    if (void 0 !== t) {
      const e = Xo(t, n);
      if (e) return fo(e) || !ji(o) ? void 0 : [o, e];
    } else if (o === r) return [r, oi(n)];
  }
}
function j(t, e, n) {
  B = !0;
  const r = performance.now() - z > 100;
  try {
    oo(t, () => {
      const o =
          kr() ||
          (function (t) {
            return t.getEditorState().read(() => {
              const t = kr();
              return null !== t ? t.clone() : null;
            });
          })(t),
        s = new Map(),
        l = t.getRootElement(),
        c = t._editorState,
        a = t._blockCursorElement;
      let u = !1,
        f = '';
      for (let n = 0; n < e.length; n++) {
        const d = e[n],
          h = d.type,
          g = d.target,
          _ = Y(g, t, c, l);
        if (!_) continue;
        const [p, y] = _;
        if ('characterData' === h) r && Zn(y) && $o(g) && J(o, g, y) && U(g, y, t);
        else if ('childList' === h) {
          u = !0;
          const e = d.addedNodes;
          for (let n = 0; n < e.length; n++) {
            const r = e[n],
              o = Qo(r),
              s = r.parentNode;
            if (null != s && r !== a && null === o && !$(r, s, t)) {
              if (i) {
                const t = (ji(r) ? r.innerText : null) || r.nodeValue;
                t && (f += t);
              }
              s.removeChild(r);
            }
          }
          const n = d.removedNodes,
            r = n.length;
          if (r > 0) {
            let e = 0;
            for (let o = 0; o < r; o++) {
              const r = n[o];
              ($(r, g, t) || a === r) && (g.appendChild(r), e++);
            }
            r !== e && s.set(p, y);
          }
        }
      }
      if (s.size > 0) for (const [e, n] of s) n.reconcileObservedMutation(e, t);
      const d = n.takeRecords();
      if (d.length > 0) {
        for (let e = 0; e < d.length; e++) {
          const n = d[e],
            r = n.addedNodes,
            o = n.target;
          for (let e = 0; e < r.length; e++) {
            const n = r[e],
              i = n.parentNode;
            null == i || 'BR' !== n.nodeName || $(n, o, t) || i.removeChild(n);
          }
        }
        n.takeRecords();
      }
      null !== o && (u && ii(o), i && ki(t) && o.insertRawText(f));
    });
  } finally {
    B = !1;
  }
}
function H(t) {
  const e = t._observer;
  if (null !== e) {
    j(t, e.takeRecords(), e);
  }
}
function V(t) {
  (!(function (t) {
    0 === z && Li(t).addEventListener('textInput', W, !0);
  })(t),
    (t._observer = new MutationObserver((e, n) => {
      j(t, e, n);
    })));
}
class G {
  key;
  parse;
  unparse;
  isEqual;
  defaultValue;
  constructor(t, e) {
    ((this.key = t),
      (this.parse = e.parse.bind(e)),
      (this.unparse = (e.unparse || nt).bind(e)),
      (this.isEqual = (e.isEqual || Object.is).bind(e)),
      (this.defaultValue = this.parse(void 0)));
  }
}
function q(t, e, n = 'latest') {
  const r = ('latest' === n ? t.getLatest() : t).__state;
  return r ? r.getValue(e) : e.defaultValue;
}
function X(t) {
  const e = new Map(),
    n = new Set();
  for (
    let r = 'function' == typeof t ? t : t.replace;
    r.prototype && void 0 !== r.prototype.getType;
    r = Object.getPrototypeOf(r)
  ) {
    const { ownNodeConfig: t } = ss(r);
    if (t && t.stateConfigs)
      for (const r of t.stateConfigs) {
        let t;
        ('stateConfig' in r ? ((t = r.stateConfig), r.flat && n.add(t.key)) : (t = r),
          e.set(t.key, t));
      }
  }
  return { flatKeys: n, sharedConfigMap: e };
}
class Q {
  node;
  knownState;
  unknownState;
  sharedNodeState;
  size;
  constructor(t, e, n = void 0, r = new Map(), o = void 0) {
    ((this.node = t), (this.sharedNodeState = e), (this.unknownState = n), (this.knownState = r));
    const { sharedConfigMap: i } = this.sharedNodeState,
      s =
        void 0 !== o
          ? o
          : (function (t, e, n) {
              let r = n.size;
              if (e)
                for (const o in e) {
                  const e = t.get(o);
                  (e && n.has(e)) || r++;
                }
              return r;
            })(i, n, r);
    this.size = s;
  }
  getValue(t) {
    const e = this.knownState.get(t);
    if (void 0 !== e) return e;
    this.sharedNodeState.sharedConfigMap.set(t.key, t);
    let n = t.defaultValue;
    if (this.unknownState && t.key in this.unknownState) {
      const e = this.unknownState[t.key];
      (void 0 !== e && (n = t.parse(e)), this.updateFromKnown(t, n));
    }
    return n;
  }
  getInternalState() {
    return [this.unknownState, this.knownState];
  }
  toJSON() {
    const t = { ...this.unknownState },
      e = {};
    for (const [e, n] of this.knownState)
      e.isEqual(n, e.defaultValue) ? delete t[e.key] : (t[e.key] = e.unparse(n));
    for (const n of this.sharedNodeState.flatKeys) n in t && ((e[n] = t[n]), delete t[n]);
    return (et(t) && (e.$ = t), e);
  }
  getWritable(t) {
    if (this.node === t) return this;
    const { sharedNodeState: e, unknownState: n } = this,
      r = new Map(this.knownState);
    return new Q(
      t,
      e,
      (function (t, e, n) {
        let r;
        if (n)
          for (const [o, i] of Object.entries(n)) {
            const n = t.get(o);
            n ? e.has(n) || e.set(n, n.parse(i)) : ((r = r || {}), (r[o] = i));
          }
        return r;
      })(e.sharedConfigMap, r, n),
      r,
      this.size,
    );
  }
  updateFromKnown(t, e) {
    const n = t.key;
    this.sharedNodeState.sharedConfigMap.set(n, t);
    const { knownState: r, unknownState: o } = this;
    (r.has(t) || (o && n in o) || (o && (delete o[n], (this.unknownState = et(o))), this.size++),
      r.set(t, e));
  }
  updateFromUnknown(t, e) {
    const n = this.sharedNodeState.sharedConfigMap.get(t);
    n
      ? this.updateFromKnown(n, n.parse(e))
      : ((this.unknownState = this.unknownState || {}),
        t in this.unknownState || this.size++,
        (this.unknownState[t] = e));
  }
  updateFromJSON(t) {
    const { knownState: e } = this;
    for (const t of e.keys()) e.set(t, t.defaultValue);
    if (((this.size = e.size), (this.unknownState = void 0), t))
      for (const [e, n] of Object.entries(t)) this.updateFromUnknown(e, n);
  }
}
function Z(t) {
  const e = t.getWritable(),
    n = e.__state ? e.__state.getWritable(e) : new Q(e, tt(e));
  return ((e.__state = n), n);
}
function tt(t) {
  return t.__state ? t.__state.sharedNodeState : wo(Qi(), t.getType()).sharedNodeState;
}
function et(t) {
  if (t) for (const e in t) return t;
}
function nt(t) {
  return t;
}
function rt(t, e, n) {
  for (const [r, o] of e.knownState) {
    if (t.has(r.key)) continue;
    t.add(r.key);
    const e = n ? n.getValue(r) : r.defaultValue;
    if (e !== o && !r.isEqual(e, o)) return !0;
  }
  return !1;
}
function ot(t, e, n) {
  const { unknownState: r } = e,
    o = n ? n.unknownState : void 0;
  if (r)
    for (const [e, n] of Object.entries(r)) {
      if (t.has(e)) continue;
      t.add(e);
      if (n !== (o ? o[e] : void 0)) return !0;
    }
  return !1;
}
function it(t, e) {
  const n = t.__state;
  return n && n.node === t ? n.getWritable(e) : n;
}
function st(t, e) {
  const n = t.__mode,
    r = t.__format,
    o = t.__style,
    i = e.__mode,
    s = e.__format,
    l = e.__style,
    c = t.__state,
    a = e.__state;
  return (
    (null === n || n === i) &&
    (null === r || r === s) &&
    (null === o || o === l) &&
    (null === t.__state ||
      c === a ||
      (function (t, e) {
        if (t === e) return !0;
        if (t && e && t.size !== e.size) return !1;
        const n = new Set();
        return !(
          (t && rt(n, t, e)) ||
          (e && rt(n, e, t)) ||
          (t && ot(n, t, e)) ||
          (e && ot(n, e, t))
        );
      })(c, a))
  );
}
function lt(t, e) {
  const n = t.mergeWithSibling(e),
    r = jr()._normalizedNodes;
  return (r.add(t.__key), r.add(e.__key), n);
}
function ct(t) {
  let e,
    n,
    r = t;
  if ('' !== r.__text || !r.isSimpleText() || r.isUnmergeable()) {
    for (
      ;
      null !== (e = r.getPreviousSibling()) && Zn(e) && e.isSimpleText() && !e.isUnmergeable();
    ) {
      if ('' !== e.__text) {
        if (st(e, r)) {
          r = lt(e, r);
          break;
        }
        break;
      }
      e.remove();
    }
    for (; null !== (n = r.getNextSibling()) && Zn(n) && n.isSimpleText() && !n.isUnmergeable(); ) {
      if ('' !== n.__text) {
        if (st(r, n)) {
          r = lt(r, n);
          break;
        }
        break;
      }
      n.remove();
    }
  } else r.remove();
}
function at(t) {
  return (ut(t.anchor), ut(t.focus), t);
}
function ut(t) {
  for (; 'element' === t.type; ) {
    const e = t.getNode(),
      n = t.offset;
    let r, o;
    if (
      (n === e.getChildrenSize()
        ? ((r = e.getChildAtIndex(n - 1)), (o = !0))
        : ((r = e.getChildAtIndex(n)), (o = !1)),
      Zn(r))
    ) {
      t.set(r.__key, o ? r.getTextContentSize() : 0, 'text', !0);
      break;
    }
    if (!co(r)) break;
    t.set(r.__key, o ? r.getChildrenSize() : 0, 'element', !0);
  }
}
let ft,
  dt,
  ht,
  gt,
  _t,
  pt,
  yt,
  mt,
  xt,
  Ct,
  St = '',
  Nt = null,
  Tt = null,
  vt = '',
  kt = !1,
  Et = !1;
function Ot(t, e) {
  const n = yt.get(t);
  if (null !== e) {
    const n = Jt(t);
    n.parentNode === e && e.removeChild(n);
  }
  if ((mt.has(t) || dt._keyToDOMMap.delete(t), co(n))) {
    const t = Bt(n, yt);
    bt(t, 0, t.length - 1, null);
  }
  void 0 !== n && Ni(Ct, ht, gt, n, 'destroyed');
}
function bt(t, e, n, r) {
  let o = e;
  for (; o <= n; ++o) {
    const e = t[o];
    void 0 !== e && Ot(e, r);
  }
}
function Mt(t, e) {
  t.setProperty('text-align', e);
}
const At = '40px';
function wt(t, e) {
  const n = ft.theme.indent;
  if ('string' == typeof n) {
    const r = t.classList.contains(n);
    e > 0 && !r ? t.classList.add(n) : e < 1 && r && t.classList.remove(n);
  }
  const r = getComputedStyle(t).getPropertyValue('--lexical-indent-base-value') || At;
  t.style.setProperty('padding-inline-start', 0 === e ? '' : `calc(${e} * ${r})`);
}
function Dt(t, e) {
  const n = t.style;
  0 === e
    ? Mt(n, '')
    : 1 === e
      ? Mt(n, 'left')
      : 2 === e
        ? Mt(n, 'center')
        : 3 === e
          ? Mt(n, 'right')
          : 4 === e
            ? Mt(n, 'justify')
            : 5 === e
              ? Mt(n, 'start')
              : 6 === e && Mt(n, 'end');
}
function Pt(t, e) {
  const n = (function (t) {
    const e = t.__dir;
    if (null !== e) return e;
    if (go(t)) return null;
    const n = t.getParentOrThrow();
    return go(n) && null === n.__dir ? 'auto' : null;
  })(e);
  null !== n ? (t.dir = n) : t.removeAttribute('dir');
}
function It(e, n) {
  const r = mt.get(e);
  void 0 === r && t(60);
  const o = r.createDOM(ft, dt);
  if (
    ((function (t, e, n) {
      const r = n._keyToDOMMap;
      ((function (t, e, n) {
        const r = `__lexicalKey_${e._key}`;
        t[r] = n;
      })(e, n, t),
        r.set(t, e));
    })(e, o, dt),
    Zn(r)
      ? o.setAttribute('data-lexical-text', 'true')
      : fo(r) && o.setAttribute('data-lexical-decorator', 'true'),
    co(r))
  ) {
    const t = r.__indent,
      e = r.__size;
    if ((Pt(o, r), 0 !== t && wt(o, t), 0 !== e)) {
      const t = e - 1;
      Lt(Bt(r, mt), r, 0, t, r.getDOMSlot(o));
    }
    const n = r.__format;
    (0 !== n && Dt(o, n), r.isInline() || Rt(null, r, o), Oi(r) && ((St += k), (vt += k)));
  } else {
    const t = r.getTextContent();
    if (fo(r)) {
      const t = r.decorate(dt, ft);
      (null !== t && Wt(e, t), (o.contentEditable = 'false'));
    }
    ((St += t), (vt += t));
  }
  return (null !== n && n.insertChild(o), Ni(Ct, ht, gt, r, 'created'), o);
}
function Lt(t, e, n, r, o) {
  const i = St;
  St = '';
  let s = n;
  for (; s <= r; ++s) {
    It(t[s], o);
    const e = mt.get(t[s]);
    null !== e && Zn(e) && null === Nt && ((Nt = e.getFormat()), (Tt = e.getStyle()));
  }
  Oi(e) && (St += k);
  ((o.element.__lexicalTextContent = St), (St = i + St));
}
function Ft(t, e) {
  if (t) {
    const n = t.__last;
    if (n) {
      const t = e.get(n);
      if (t) return Ln(t) ? 'line-break' : fo(t) && t.isInline() ? 'decorator' : null;
    }
    return 'empty';
  }
  return null;
}
function Rt(t, e, n) {
  const r = Ft(t, yt),
    o = Ft(e, mt);
  r !== o && e.getDOMSlot(n).setManagedLineBreak(o);
}
function Kt(e, n, r) {
  var o;
  ((Nt = null),
    (Tt = null),
    (function (e, n, r) {
      const o = St,
        i = e.__size,
        s = n.__size;
      St = '';
      const l = r.element;
      if (1 === i && 1 === s) {
        const t = e.__first,
          r = n.__first;
        if (t === r) zt(t, l);
        else {
          const e = Jt(t),
            n = It(r, null);
          try {
            l.replaceChild(n, e);
          } catch (o) {
            if ('object' == typeof o && null != o) {
              const i = `${o.toString()} Parent: ${l.tagName}, new child: {tag: ${n.tagName} key: ${r}}, old child: {tag: ${e.tagName}, key: ${t}}.`;
              throw new Error(i);
            }
            throw o;
          }
          Ot(t, null);
        }
        const o = mt.get(r);
        Zn(o) && null === Nt && ((Nt = o.getFormat()), (Tt = o.getStyle()));
      } else {
        const o = Bt(e, yt),
          c = Bt(n, mt);
        if ((o.length !== i && t(227), c.length !== s && t(228), 0 === i))
          0 !== s && Lt(c, n, 0, s - 1, r);
        else if (0 === s) {
          if (0 !== i) {
            const t = null == r.after && null == r.before && null == r.element.__lexicalLineBreak;
            (bt(o, 0, i - 1, t ? null : l), t && (l.textContent = ''));
          }
        } else
          !(function (t, e, n, r, o, i) {
            const s = r - 1,
              l = o - 1;
            let c,
              a,
              u = i.getFirstChild(),
              f = 0,
              d = 0;
            for (; f <= s && d <= l; ) {
              const t = e[f],
                r = n[d];
              if (t === r) ((u = $t(zt(r, i.element))), f++, d++);
              else {
                (void 0 === c && (c = new Set(e)), void 0 === a && (a = new Set(n)));
                const o = a.has(t),
                  s = c.has(r);
                if (o)
                  if (s) {
                    const t = bi(dt, r);
                    (t === u
                      ? (u = $t(zt(r, i.element)))
                      : (i.withBefore(u).insertChild(t), zt(r, i.element)),
                      f++,
                      d++);
                  } else (It(r, i.withBefore(u)), d++);
                else ((u = $t(Jt(t))), Ot(t, i.element), f++);
              }
              const o = mt.get(r);
              null !== o && Zn(o) && null === Nt && ((Nt = o.getFormat()), (Tt = o.getStyle()));
            }
            const h = f > s,
              g = d > l;
            if (h && !g) {
              const e = n[l + 1],
                r = void 0 === e ? null : dt.getElementByKey(e);
              Lt(n, t, d, l, i.withBefore(r));
            } else g && !h && bt(e, f, s, i.element);
          })(n, o, c, i, s, r);
      }
      Oi(n) && (St += k);
      ((l.__lexicalTextContent = St), (St = o + St));
    })(e, n, n.getDOMSlot(r)),
    (o = n),
    null == Nt || Nt === o.__textFormat || Et || o.setTextFormat(Nt),
    (function (t) {
      null == Tt || Tt === t.__textStyle || Et || t.setTextStyle(Tt);
    })(n));
}
function Bt(e, n) {
  const r = [];
  let o = e.__first;
  for (; null !== o; ) {
    const e = n.get(o);
    (void 0 === e && t(101), r.push(o), (o = e.__next));
  }
  return r;
}
function zt(e, n) {
  const r = yt.get(e);
  let o = mt.get(e);
  (void 0 !== r && void 0 !== o) || t(61);
  const i = kt || pt.has(e) || _t.has(e),
    s = bi(dt, e);
  if (r === o && !i) {
    if (co(r)) {
      const t = s.__lexicalTextContent;
      void 0 !== t && ((St += t), (vt += t));
    } else {
      const t = r.getTextContent();
      ((vt += t), (St += t));
    }
    return s;
  }
  if ((r !== o && i && Ni(Ct, ht, gt, o, 'updated'), o.updateDOM(r, s, ft))) {
    const r = It(e, null);
    return (null === n && t(62), n.replaceChild(r, s), Ot(e, null), r);
  }
  if (co(r) && co(o)) {
    const t = o.__indent;
    (kt || t !== r.__indent) && wt(s, t);
    const e = o.__format;
    if (
      ((kt || e !== r.__format) && Dt(s, e),
      i && (Kt(r, o, s), go(o) || o.isInline() || Rt(r, o, s)),
      Oi(o) && ((St += k), (vt += k)),
      (kt || o.__dir !== r.__dir) && (Pt(s, o), go(o) && !kt))
    )
      for (const t of o.getChildren())
        if (co(t)) {
          Pt(bi(dt, t.getKey()), t);
        }
  } else {
    const t = o.getTextContent();
    if (fo(o)) {
      const t = o.decorate(dt, ft);
      null !== t && Wt(e, t);
    }
    ((St += t), (vt += t));
  }
  if (!Et && go(o) && o.__cachedText !== vt) {
    const t = o.getWritable();
    ((t.__cachedText = vt), (o = t));
  }
  return s;
}
function Wt(t, e) {
  let n = dt._pendingDecorators;
  const r = dt._decorators;
  if (null === n) {
    if (r[t] === e) return;
    n = ei(dt);
  }
  n[t] = e;
}
function $t(t) {
  let e = t.nextSibling;
  return (null !== e && e === dt._blockCursorElement && (e = e.nextSibling), e);
}
function Ut(t, e, n, r, o, i) {
  ((St = ''),
    (vt = ''),
    (kt = 2 === r),
    (dt = n),
    (ft = n._config),
    (ht = n._nodes),
    (gt = dt._listeners.mutation),
    (_t = o),
    (pt = i),
    (yt = t._nodeMap),
    (mt = e._nodeMap),
    (Et = e._readOnly),
    (xt = new Map(n._keyToDOMMap)));
  const s = new Map();
  return (
    (Ct = s),
    zt('root', null),
    (dt = void 0),
    (ht = void 0),
    (_t = void 0),
    (pt = void 0),
    (yt = void 0),
    (mt = void 0),
    (ft = void 0),
    (xt = void 0),
    (Ct = void 0),
    s
  );
}
function Jt(e) {
  const n = xt.get(e);
  return (void 0 === n && t(75, e), n);
}
function Yt(t) {
  return { type: t };
}
const jt = Yt('SELECTION_CHANGE_COMMAND'),
  Ht = Yt('SELECTION_INSERT_CLIPBOARD_NODES_COMMAND'),
  Vt = Yt('CLICK_COMMAND'),
  Gt = Yt('BEFORE_INPUT_COMMAND'),
  qt = Yt('INPUT_COMMAND'),
  Xt = Yt('COMPOSITION_START_COMMAND'),
  Qt = Yt('COMPOSITION_END_COMMAND'),
  Zt = Yt('DELETE_CHARACTER_COMMAND'),
  te = Yt('INSERT_LINE_BREAK_COMMAND'),
  ee = Yt('INSERT_PARAGRAPH_COMMAND'),
  ne = Yt('CONTROLLED_TEXT_INSERTION_COMMAND'),
  re = Yt('PASTE_COMMAND'),
  oe = Yt('REMOVE_TEXT_COMMAND'),
  ie = Yt('DELETE_WORD_COMMAND'),
  se = Yt('DELETE_LINE_COMMAND'),
  le = Yt('FORMAT_TEXT_COMMAND'),
  ce = Yt('UNDO_COMMAND'),
  ae = Yt('REDO_COMMAND'),
  ue = Yt('KEYDOWN_COMMAND'),
  fe = Yt('KEY_ARROW_RIGHT_COMMAND'),
  de = Yt('MOVE_TO_END'),
  he = Yt('KEY_ARROW_LEFT_COMMAND'),
  ge = Yt('MOVE_TO_START'),
  _e = Yt('KEY_ARROW_UP_COMMAND'),
  pe = Yt('KEY_ARROW_DOWN_COMMAND'),
  ye = Yt('KEY_ENTER_COMMAND'),
  me = Yt('KEY_SPACE_COMMAND'),
  xe = Yt('KEY_BACKSPACE_COMMAND'),
  Ce = Yt('KEY_ESCAPE_COMMAND'),
  Se = Yt('KEY_DELETE_COMMAND'),
  Ne = Yt('KEY_TAB_COMMAND'),
  Te = Yt('INSERT_TAB_COMMAND'),
  ve = Yt('INDENT_CONTENT_COMMAND'),
  ke = Yt('OUTDENT_CONTENT_COMMAND'),
  Ee = Yt('DROP_COMMAND'),
  Oe = Yt('FORMAT_ELEMENT_COMMAND'),
  be = Yt('DRAGSTART_COMMAND'),
  Me = Yt('DRAGOVER_COMMAND'),
  Ae = Yt('DRAGEND_COMMAND'),
  we = Yt('COPY_COMMAND'),
  De = Yt('CUT_COMMAND'),
  Pe = Yt('SELECT_ALL_COMMAND'),
  Ie = Yt('CLEAR_EDITOR_COMMAND'),
  Le = Yt('CLEAR_HISTORY_COMMAND'),
  Fe = Yt('CAN_REDO_COMMAND'),
  Re = Yt('CAN_UNDO_COMMAND'),
  Ke = Yt('FOCUS_COMMAND'),
  Be = Yt('BLUR_COMMAND'),
  ze = Yt('KEY_MODIFIER_COMMAND'),
  We = Object.freeze({}),
  $e = [
    [
      'keydown',
      function (t, e) {
        if (((Ue = t.timeStamp), (Je = t.key), e.isComposing())) return;
        Ei(e, ue, t);
      },
    ],
    [
      'pointerdown',
      function (t, e) {
        const n = t.target,
          r = t.pointerType;
        Hi(n) &&
          'touch' !== r &&
          'pen' !== r &&
          0 === t.button &&
          oo(e, () => {
            Io(n) || (qe = !0);
          });
      },
    ],
    [
      'compositionstart',
      function (t, e) {
        Ei(e, Xt, t);
      },
    ],
    [
      'compositionend',
      function (t, e) {
        i ? (Qe = !0) : c || (!l && !d) ? Ei(e, Qt, t) : ((Ze = !0), (tn = t.data));
      },
    ],
    [
      'input',
      function (t, e) {
        (t.stopPropagation(),
          oo(
            e,
            () => {
              e.dispatchCommand(qt, t);
            },
            { event: t },
          ),
          (je = null));
      },
    ],
    [
      'click',
      function (t, e) {
        oo(e, () => {
          const n = kr(),
            r = Ji(Li(e)),
            o = Er();
          if (r)
            if (ar(n)) {
              const e = n.anchor,
                i = e.getNode();
              if (
                'element' === e.type &&
                0 === e.offset &&
                n.isCollapsed() &&
                !go(i) &&
                1 === ri().getChildrenSize() &&
                i.getTopLevelElementOrThrow().isEmpty() &&
                null !== o &&
                n.is(o)
              )
                (r.removeAllRanges(), (n.dirty = !0));
              else if (3 === t.detail && !n.isCollapsed()) {
                if (i !== n.focus.getNode()) {
                  const t = ls(i, (t) => co(t) && !t.isInline());
                  co(t) && t.select(0);
                }
              }
            } else if ('touch' === t.pointerType || 'pen' === t.pointerType) {
              const n = r.anchorNode;
              if (ji(n) || $o(n)) {
                ii(vr(o, r, e, t));
              }
            }
          Ei(e, Vt, t);
        });
      },
    ],
    ['cut', We],
    ['copy', We],
    ['dragstart', We],
    ['dragover', We],
    ['dragend', We],
    ['paste', We],
    ['focus', We],
    ['blur', We],
    ['drop', We],
  ];
s &&
  $e.push([
    'beforeinput',
    (t, e) =>
      (function (t, e) {
        const n = t.inputType;
        if ('deleteCompositionText' === n || (i && ki(e))) return;
        if ('insertCompositionText' === n) return;
        Ei(e, Gt, t);
      })(t, e),
  ]);
let Ue = 0,
  Je = null,
  Ye = 0,
  je = null;
const He = new WeakMap(),
  Ve = new WeakMap();
let Ge = !1,
  qe = !1,
  Xe = !1,
  Qe = !1,
  Ze = !1,
  tn = '',
  en = null,
  nn = [0, '', 0, 'root', 0];
function rn(t, e, n, r, o) {
  const i = t.anchor,
    l = t.focus,
    c = i.getNode(),
    a = jr(),
    u = Ji(Li(a)),
    f = null !== u ? u.anchorNode : null,
    d = i.key,
    h = a.getElementByKey(d),
    g = n.length;
  return (
    d !== l.key ||
    !Zn(c) ||
    (((!o && (!s || Ye < r + 50)) || (c.isDirty() && g < 2) || li(n)) &&
      i.offset !== l.offset &&
      !c.isComposing()) ||
    Wo(c) ||
    (c.isDirty() && g > 1) ||
    ((o || !s) && null !== h && !c.isComposing() && f !== Jo(h)) ||
    (null !== u &&
      null !== e &&
      (!e.collapsed || e.startContainer !== u.anchorNode || e.startOffset !== u.anchorOffset)) ||
    c.getFormat() !== t.format ||
    c.getStyle() !== t.style ||
    (function (t, e) {
      if (e.isSegmented()) return !0;
      if (!t.isCollapsed()) return !1;
      const n = t.anchor.offset,
        r = e.getParentOrThrow(),
        o = zo(e);
      return 0 === n
        ? !e.canInsertTextBefore() ||
            (!r.canInsertTextBefore() && !e.isComposing()) ||
            o ||
            (function (t) {
              const e = t.getPreviousSibling();
              return (Zn(e) || (co(e) && e.isInline())) && !e.canInsertTextAfter();
            })(e)
        : n === e.getTextContentSize() &&
            (!e.canInsertTextAfter() || (!r.canInsertTextAfter() && !e.isComposing()) || o);
    })(t, c)
  );
}
function on(t, e) {
  return $o(t) && null !== t.nodeValue && 0 !== e && e !== t.nodeValue.length;
}
function sn(e, n, r) {
  const { anchorNode: o, anchorOffset: i, focusNode: s, focusOffset: l } = e;
  (Ge && ((Ge = !1), on(o, i) && on(s, l) && !en)) ||
    oo(n, () => {
      if (!r) return void ii(null);
      if (!Fo(n, o, s)) return;
      let c = kr();
      if (en && ar(c) && c.isCollapsed()) {
        const t = c.anchor,
          e = en.anchor;
        ((t.key === e.key && t.offset === e.offset + 1) ||
          (1 === t.offset && e.getNode().is(t.getNode().getPreviousSibling()))) &&
          ((c = en.clone()), ii(c));
      }
      if (((en = null), ar(c))) {
        const r = c.anchor,
          o = r.getNode();
        if (c.isCollapsed()) {
          'Range' === e.type && e.anchorNode === e.focusNode && (c.dirty = !0);
          const i = Li(n).event,
            s = i ? i.timeStamp : performance.now(),
            [l, a, u, f, d] = nn,
            h = ri(),
            g = !1 === n.isComposing() && '' === h.getTextContent();
          if (s < d + 200 && r.offset === u && r.key === f) ln(c, l, a);
          else if ('text' === r.type) (Zn(o) || t(141), cn(c, o));
          else if ('element' === r.type && !g) {
            co(o) || t(259);
            const e = r.getNode();
            e.isEmpty()
              ? (function (t, e) {
                  const n = e.getTextFormat(),
                    r = e.getTextStyle();
                  ln(t, n, r);
                })(c, e)
              : ln(c, 0, '');
          }
        } else {
          const t = r.key,
            e = c.focus.key,
            n = c.getNodes(),
            o = n.length,
            s = c.isBackward(),
            a = s ? l : i,
            u = s ? i : l,
            f = s ? e : t,
            d = s ? t : e;
          let h = 2047,
            g = !1;
          for (let t = 0; t < o; t++) {
            const e = n[t],
              r = e.getTextContentSize();
            if (
              Zn(e) &&
              0 !== r &&
              !(
                (0 === t && e.__key === f && a === r) ||
                (t === o - 1 && e.__key === d && 0 === u)
              ) &&
              ((g = !0), (h &= e.getFormat()), 0 === h)
            )
              break;
          }
          c.format = g ? h : 0;
        }
      }
      Ei(n, jt, void 0);
    });
}
function ln(t, e, n) {
  (t.format === e && t.style === n) || ((t.format = e), (t.style = n), (t.dirty = !0));
}
function cn(t, e) {
  ln(t, e.getFormat(), e.getStyle());
}
function an(t) {
  if (!t.getTargetRanges) return null;
  const e = t.getTargetRanges();
  return 0 === e.length ? null : e[0];
}
function un(e) {
  const n = e.inputType,
    r = an(e),
    o = jr(),
    i = kr();
  if ('deleteContentBackward' === n) {
    if (null === i) {
      const t = Er();
      if (!ar(t)) return !0;
      ii(t.clone());
    }
    if (ar(i)) {
      const n = i.anchor.key === i.focus.key;
      if (((s = e.timeStamp), 'MediaLast' === Je && s < Ue + 30 && o.isComposing() && n)) {
        if (
          (Go(null),
          (Ue = 0),
          setTimeout(() => {
            oo(o, () => {
              Go(null);
            });
          }, 30),
          ar(i))
        ) {
          const e = i.anchor.getNode();
          (e.markDirty(), Zn(e) || t(142), cn(i, e));
        }
      } else {
        (Go(null), e.preventDefault());
        const t = i.anchor.getNode(),
          r = t.getTextContent(),
          s = t.canInsertTextAfter(),
          l = 0 === i.anchor.offset && i.focus.offset === r.length;
        let c = f && n && !l && s;
        if ((c && i.isCollapsed() && (c = !fo(vi(i.anchor, !0))), !c)) {
          Ei(o, Zt, !0);
          const t = kr();
          f && ar(t) && t.isCollapsed() && ((en = t), setTimeout(() => (en = null)));
        }
      }
      return !0;
    }
  }
  var s;
  if (!ar(i)) return !0;
  const l = e.data;
  (null !== je && fi(!1, o, je),
    (i.dirty && null === je) ||
      !i.isCollapsed() ||
      go(i.anchor.getNode()) ||
      null === r ||
      i.applyDOMRange(r),
    (je = null));
  const a = i.anchor,
    u = i.focus,
    d = a.getNode(),
    h = u.getNode();
  if ('insertText' === n || 'insertTranspose' === n) {
    if ('\n' === l) (e.preventDefault(), Ei(o, te, !1));
    else if (l === k) (e.preventDefault(), Ei(o, ee, void 0));
    else if (null == l && e.dataTransfer) {
      const t = e.dataTransfer.getData('text/plain');
      (e.preventDefault(), i.insertRawText(t));
    } else
      null != l && rn(i, r, l, e.timeStamp, !0) ? (e.preventDefault(), Ei(o, ne, l)) : (je = l);
    return ((Ye = e.timeStamp), !0);
  }
  switch ((e.preventDefault(), n)) {
    case 'insertFromYank':
    case 'insertFromDrop':
    case 'insertReplacementText':
      Ei(o, ne, e);
      break;
    case 'insertFromComposition':
      (Go(null), Ei(o, ne, e));
      break;
    case 'insertLineBreak':
      (Go(null), Ei(o, te, !1));
      break;
    case 'insertParagraph':
      (Go(null), Xe && !c ? ((Xe = !1), Ei(o, te, !1)) : Ei(o, ee, void 0));
      break;
    case 'insertFromPaste':
    case 'insertFromPasteAsQuotation':
      Ei(o, re, e);
      break;
    case 'deleteByComposition':
      (function (t, e) {
        return t !== e || co(t) || co(e) || !zo(t) || !zo(e);
      })(d, h) && Ei(o, oe, e);
      break;
    case 'deleteByDrag':
    case 'deleteByCut':
      Ei(o, oe, e);
      break;
    case 'deleteContent':
      Ei(o, Zt, !1);
      break;
    case 'deleteWordBackward':
      Ei(o, ie, !0);
      break;
    case 'deleteWordForward':
      Ei(o, ie, !1);
      break;
    case 'deleteHardLineBackward':
    case 'deleteSoftLineBackward':
      Ei(o, se, !0);
      break;
    case 'deleteContentForward':
    case 'deleteHardLineForward':
    case 'deleteSoftLineForward':
      Ei(o, se, !1);
      break;
    case 'formatStrikeThrough':
      Ei(o, le, 'strikethrough');
      break;
    case 'formatBold':
      Ei(o, le, 'bold');
      break;
    case 'formatItalic':
      Ei(o, le, 'italic');
      break;
    case 'formatUnderline':
      Ei(o, le, 'underline');
      break;
    case 'historyUndo':
      Ei(o, ce, void 0);
      break;
    case 'historyRedo':
      Ei(o, ae, void 0);
  }
  return !0;
}
function fn(t) {
  if (ji(t.target) && Io(t.target)) return !0;
  const e = jr(),
    n = kr(),
    r = t.data,
    o = an(t);
  if (null != r && ar(n) && rn(n, o, r, t.timeStamp, !1)) {
    Qe && (gn(e, r), (Qe = !1));
    const o = n.anchor.getNode(),
      a = Ji(Li(e));
    if (null === a) return !0;
    const u = n.isBackward(),
      f = u ? n.anchor.offset : n.focus.offset,
      h = u ? n.focus.offset : n.anchor.offset;
    (s &&
      !n.isCollapsed() &&
      Zn(o) &&
      null !== a.anchorNode &&
      o.getTextContent().slice(0, f) + r + o.getTextContent().slice(f + h) === ui(a.anchorNode)) ||
      Ei(e, ne, r);
    const g = r.length;
    (i &&
      g > 1 &&
      'insertCompositionText' === t.inputType &&
      !e.isComposing() &&
      (n.anchor.offset -= g),
      l || c || d || !e.isComposing() || ((Ue = 0), Go(null)));
  } else {
    (fi(!1, e, null !== r ? r : void 0), Qe && (gn(e, r || void 0), (Qe = !1)));
  }
  return (
    (function () {
      Ur();
      const t = jr();
      H(t);
    })(),
    !0
  );
}
function dn(t) {
  const e = jr(),
    n = kr();
  if (ar(n) && !e.isComposing()) {
    const r = n.anchor,
      o = n.anchor.getNode();
    (Go(r.key),
      (t.timeStamp < Ue + 30 ||
        'element' === r.type ||
        !n.isCollapsed() ||
        o.getFormat() !== n.format ||
        (Zn(o) && o.getStyle() !== n.style)) &&
        Ei(e, ne, E));
  }
  return !0;
}
function hn(t) {
  return (gn(jr(), t.data), !0);
}
function gn(t, e) {
  const n = t._compositionKey;
  if ((Go(null), null !== n && null != e)) {
    if ('' === e) {
      const e = Xo(n),
        r = Jo(t.getElementByKey(n));
      return void (
        null !== r &&
        null !== r.nodeValue &&
        Zn(e) &&
        di(e, r.nodeValue, null, null, !0)
      );
    }
    if ('\n' === e[e.length - 1]) {
      const e = kr();
      if (ar(e)) {
        const n = e.focus;
        return (e.anchor.set(n.key, n.offset, n.type), void Ei(t, ye, null));
      }
    }
  }
  fi(!0, t, e);
}
function _n(t) {
  const e = jr();
  if (null == t.key) return !0;
  if (Ze && xi(t))
    return (
      oo(e, () => {
        gn(e, tn);
      }),
      (Ze = !1),
      (tn = ''),
      !0
    );
  if (
    (function (t) {
      return pi(t, 'ArrowRight', { shiftKey: 'any' });
    })(t)
  )
    Ei(e, fe, t);
  else if (
    (function (t) {
      return pi(t, 'ArrowRight', yi);
    })(t)
  )
    Ei(e, de, t);
  else if (
    (function (t) {
      return pi(t, 'ArrowLeft', { shiftKey: 'any' });
    })(t)
  )
    Ei(e, he, t);
  else if (
    (function (t) {
      return pi(t, 'ArrowLeft', yi);
    })(t)
  )
    Ei(e, ge, t);
  else if (
    (function (t) {
      return pi(t, 'ArrowUp', { altKey: 'any', shiftKey: 'any' });
    })(t)
  )
    Ei(e, _e, t);
  else if (
    (function (t) {
      return pi(t, 'ArrowDown', { altKey: 'any', shiftKey: 'any' });
    })(t)
  )
    Ei(e, pe, t);
  else if (
    (function (t) {
      return pi(t, 'Enter', { altKey: 'any', ctrlKey: 'any', metaKey: 'any', shiftKey: !0 });
    })(t)
  )
    ((Xe = !0), Ei(e, ye, t));
  else if (
    (function (t) {
      return ' ' === t.key;
    })(t)
  )
    Ei(e, me, t);
  else if (
    (function (t) {
      return o && pi(t, 'o', { ctrlKey: !0 });
    })(t)
  )
    (t.preventDefault(), (Xe = !0), Ei(e, te, !0));
  else if (
    (function (t) {
      return pi(t, 'Enter', { altKey: 'any', ctrlKey: 'any', metaKey: 'any' });
    })(t)
  )
    ((Xe = !1), Ei(e, ye, t));
  else if (
    (function (t) {
      return pi(t, 'Backspace', { shiftKey: 'any' }) || (o && pi(t, 'h', { ctrlKey: !0 }));
    })(t)
  )
    xi(t) ? Ei(e, xe, t) : (t.preventDefault(), Ei(e, Zt, !0));
  else if (
    (function (t) {
      return 'Escape' === t.key;
    })(t)
  )
    Ei(e, Ce, t);
  else if (
    (function (t) {
      return pi(t, 'Delete', {}) || (o && pi(t, 'd', { ctrlKey: !0 }));
    })(t)
  )
    !(function (t) {
      return 'Delete' === t.key;
    })(t)
      ? (t.preventDefault(), Ei(e, Zt, !1))
      : Ei(e, Se, t);
  else if (
    (function (t) {
      return pi(t, 'Backspace', mi);
    })(t)
  )
    (t.preventDefault(), Ei(e, ie, !0));
  else if (
    (function (t) {
      return pi(t, 'Delete', mi);
    })(t)
  )
    (t.preventDefault(), Ei(e, ie, !1));
  else if (
    (function (t) {
      return o && pi(t, 'Backspace', { metaKey: !0 });
    })(t)
  )
    (t.preventDefault(), Ei(e, se, !0));
  else if (
    (function (t) {
      return o && (pi(t, 'Delete', { metaKey: !0 }) || pi(t, 'k', { ctrlKey: !0 }));
    })(t)
  )
    (t.preventDefault(), Ei(e, se, !1));
  else if (
    (function (t) {
      return pi(t, 'b', yi);
    })(t)
  )
    (t.preventDefault(), Ei(e, le, 'bold'));
  else if (
    (function (t) {
      return pi(t, 'u', yi);
    })(t)
  )
    (t.preventDefault(), Ei(e, le, 'underline'));
  else if (
    (function (t) {
      return pi(t, 'i', yi);
    })(t)
  )
    (t.preventDefault(), Ei(e, le, 'italic'));
  else if (
    (function (t) {
      return pi(t, 'Tab', { shiftKey: 'any' });
    })(t)
  )
    Ei(e, Ne, t);
  else if (
    (function (t) {
      return pi(t, 'z', yi);
    })(t)
  )
    (t.preventDefault(), Ei(e, ce, void 0));
  else if (
    (function (t) {
      if (o) return pi(t, 'z', { metaKey: !0, shiftKey: !0 });
      return pi(t, 'y', { ctrlKey: !0 }) || pi(t, 'z', { ctrlKey: !0, shiftKey: !0 });
    })(t)
  )
    (t.preventDefault(), Ei(e, ae, void 0));
  else {
    const n = e._editorState._selection;
    null === n || ar(n)
      ? Ci(t) && (t.preventDefault(), Ei(e, Pe, t))
      : !(function (t) {
            return pi(t, 'c', yi);
          })(t)
        ? !(function (t) {
            return pi(t, 'x', yi);
          })(t)
          ? Ci(t) && (t.preventDefault(), Ei(e, Pe, t))
          : (t.preventDefault(), Ei(e, De, t))
        : (t.preventDefault(), Ei(e, we, t));
  }
  return (
    (function (t) {
      return t.ctrlKey || t.shiftKey || t.altKey || t.metaKey;
    })(t) && e.dispatchCommand(ze, t),
    !0
  );
}
function pn(t) {
  let e = t.__lexicalEventHandles;
  return (void 0 === e && ((e = []), (t.__lexicalEventHandles = e)), e);
}
const yn = new Map();
function mn(t) {
  const e = Yi(t.target);
  if (null === e) return;
  const n = Ko(e.anchorNode);
  if (null === n) return;
  qe &&
    ((qe = !1),
    oo(n, () => {
      const r = Er(),
        o = e.anchorNode;
      if (ji(o) || $o(o)) {
        ii(vr(r, e, n, t));
      }
    }));
  const r = ci(n),
    o = r[r.length - 1],
    i = o._key,
    s = yn.get(i),
    l = s || o;
  (l !== n && sn(e, l, !1), sn(e, n, !0), n !== o ? yn.set(i, n) : s && yn.delete(i));
}
function xn(t) {
  t._lexicalHandled = !0;
}
function Cn(t) {
  return !0 === t._lexicalHandled;
}
const Sn = () => {};
function Nn(e) {
  const n = He.get(e);
  if (void 0 === n) return void Sn();
  const r = Ve.get(n);
  if (void 0 === r) return void Sn();
  const o = r - 1;
  (o >= 0 || t(164),
    He.delete(e),
    Ve.set(n, o),
    0 === o && n.removeEventListener('selectionchange', mn));
  const i = Bo(e);
  Ro(i)
    ? (!(function (t) {
        if (null !== t._parentEditor) {
          const e = ci(t),
            n = e[e.length - 1]._key;
          yn.get(n) === t && yn.delete(n);
        } else yn.delete(t._key);
      })(i),
      (e.__lexicalEditor = null))
    : i && t(198);
  const s = pn(e);
  for (let t = 0; t < s.length; t++) s[t]();
  e.__lexicalEventHandles = [];
}
function Tn(t, e, n) {
  Ur();
  const r = t.__key,
    o = t.getParent();
  if (null === o) return;
  const i = (function (t) {
    const e = kr();
    if (!ar(e) || !co(t)) return e;
    const { anchor: n, focus: r } = e,
      o = n.getNode(),
      i = r.getNode();
    Pi(o, t) && n.set(t.__key, 0, 'element');
    Pi(i, t) && r.set(t.__key, 0, 'element');
    return e;
  })(t);
  let s = !1;
  if (ar(i) && e) {
    const e = i.anchor,
      n = i.focus;
    (e.key === r && (Mr(e, t, o, t.getPreviousSibling(), t.getNextSibling()), (s = !0)),
      n.key === r && (Mr(n, t, o, t.getPreviousSibling(), t.getNextSibling()), (s = !0)));
  } else fr(i) && e && t.isSelected() && t.selectPrevious();
  if (ar(i) && e && !s) {
    const e = t.getIndexWithinParent();
    (Ho(t), Or(i, o, e, -1));
  } else Ho(t);
  (n || Ri(o) || o.canBeEmpty() || !o.isEmpty() || Tn(o, e),
    e && i && go(o) && o.isEmpty() && o.selectEnd());
}
const vn = Symbol.for('ephemeral');
function kn(t) {
  return t[vn] || !1;
}
class En {
  __type;
  __key;
  __parent;
  __prev;
  __next;
  __state;
  static getType() {
    const { ownNodeType: e } = ss(this);
    return (void 0 === e && t(64, this.name), e);
  }
  static clone(e) {
    t(65, this.name);
  }
  $config() {
    return {};
  }
  config(t, e) {
    const n = e.extends || Object.getPrototypeOf(this.constructor);
    return (Object.assign(e, { extends: n, type: t }), { [t]: e });
  }
  afterCloneFrom(t) {
    this.__key === t.__key
      ? ((this.__parent = t.__parent),
        (this.__next = t.__next),
        (this.__prev = t.__prev),
        (this.__state = t.__state))
      : t.__state && (this.__state = t.__state.getWritable(this));
  }
  static importDOM;
  constructor(t) {
    ((this.__type = this.constructor.getType()),
      (this.__parent = null),
      (this.__prev = null),
      (this.__next = null),
      Object.defineProperty(this, '__state', {
        configurable: !0,
        enumerable: !1,
        value: void 0,
        writable: !0,
      }),
      jo(this, t));
  }
  getType() {
    return this.__type;
  }
  isInline() {
    t(137, this.constructor.name);
  }
  isAttached() {
    let t = this.__key;
    for (; null !== t; ) {
      if ('root' === t) return !0;
      const e = Xo(t);
      if (null === e) break;
      t = e.__parent;
    }
    return !1;
  }
  isSelected(t) {
    const e = t || kr();
    if (null == e) return !1;
    const n = e.getNodes().some((t) => t.__key === this.__key);
    if (Zn(this)) return n;
    if (ar(e) && 'element' === e.anchor.type && 'element' === e.focus.type) {
      if (e.isCollapsed()) return !1;
      const t = this.getParent();
      if (fo(this) && this.isInline() && t) {
        const n = e.isBackward() ? e.focus : e.anchor;
        if (t.is(n.getNode()) && n.offset === t.getChildrenSize() && this.is(t.getLastChild()))
          return !1;
      }
    }
    return n;
  }
  getKey() {
    return this.__key;
  }
  getIndexWithinParent() {
    const t = this.getParent();
    if (null === t) return -1;
    let e = t.getFirstChild(),
      n = 0;
    for (; null !== e; ) {
      if (this.is(e)) return n;
      (n++, (e = e.getNextSibling()));
    }
    return -1;
  }
  getParent() {
    const t = this.getLatest().__parent;
    return null === t ? null : Xo(t);
  }
  getParentOrThrow() {
    const e = this.getParent();
    return (null === e && t(66, this.__key), e);
  }
  getTopLevelElement() {
    let e = this;
    for (; null !== e; ) {
      const n = e.getParent();
      if (Ri(n)) return (co(e) || (e === this && fo(e)) || t(194), e);
      e = n;
    }
    return null;
  }
  getTopLevelElementOrThrow() {
    const e = this.getTopLevelElement();
    return (null === e && t(67, this.__key), e);
  }
  getParents() {
    const t = [];
    let e = this.getParent();
    for (; null !== e; ) (t.push(e), (e = e.getParent()));
    return t;
  }
  getParentKeys() {
    const t = [];
    let e = this.getParent();
    for (; null !== e; ) (t.push(e.__key), (e = e.getParent()));
    return t;
  }
  getPreviousSibling() {
    const t = this.getLatest().__prev;
    return null === t ? null : Xo(t);
  }
  getPreviousSiblings() {
    const t = [],
      e = this.getParent();
    if (null === e) return t;
    let n = e.getFirstChild();
    for (; null !== n && !n.is(this); ) (t.push(n), (n = n.getNextSibling()));
    return t;
  }
  getNextSibling() {
    const t = this.getLatest().__next;
    return null === t ? null : Xo(t);
  }
  getNextSiblings() {
    const t = [];
    let e = this.getNextSibling();
    for (; null !== e; ) (t.push(e), (e = e.getNextSibling()));
    return t;
  }
  getCommonAncestor(t) {
    const e = co(this) ? this : this.getParent(),
      n = co(t) ? t : t.getParent(),
      r = e && n ? Bs(e, n) : null;
    return r ? r.commonAncestor : null;
  }
  is(t) {
    return null != t && this.__key === t.__key;
  }
  isBefore(e) {
    const n = Bs(this, e);
    return (
      null !== n &&
      ('descendant' === n.type ||
        ('branch' === n.type
          ? -1 === Fs(n)
          : ('same' !== n.type && 'ancestor' !== n.type && t(279), !1)))
    );
  }
  isParentOf(t) {
    const e = Bs(this, t);
    return null !== e && 'ancestor' === e.type;
  }
  getNodesBetween(e) {
    const n = this.isBefore(e),
      r = [],
      o = new Set();
    let i = this;
    for (; null !== i; ) {
      const s = i.__key;
      if ((o.has(s) || (o.add(s), r.push(i)), i === e)) break;
      const l = co(i) ? (n ? i.getFirstChild() : i.getLastChild()) : null;
      if (null !== l) {
        i = l;
        continue;
      }
      const c = n ? i.getNextSibling() : i.getPreviousSibling();
      if (null !== c) {
        i = c;
        continue;
      }
      const a = i.getParentOrThrow();
      if ((o.has(a.__key) || r.push(a), a === e)) break;
      let u = null,
        f = a;
      do {
        if (
          (null === f && t(68),
          (u = n ? f.getNextSibling() : f.getPreviousSibling()),
          (f = f.getParent()),
          null === f)
        )
          break;
        null !== u || o.has(f.__key) || r.push(f);
      } while (null === u);
      i = u;
    }
    return (n || r.reverse(), r);
  }
  isDirty() {
    const t = jr()._dirtyLeaves;
    return null !== t && t.has(this.__key);
  }
  getLatest() {
    if (kn(this)) return this;
    const e = Xo(this.__key);
    return (null === e && t(113), e);
  }
  getWritable() {
    if (kn(this)) return this;
    Ur();
    const t = Yr(),
      e = jr(),
      n = t._nodeMap,
      r = this.__key,
      o = this.getLatest(),
      i = e._cloneNotNeeded,
      s = kr();
    if ((null !== s && s.setCachedNodes(null), i.has(r))) return (Vo(o), o);
    const l = ns(o);
    return (i.add(r), Vo(l), n.set(r, l), l);
  }
  getTextContent() {
    return '';
  }
  getTextContentSize() {
    return this.getTextContent().length;
  }
  createDOM(e, n) {
    t(70);
  }
  updateDOM(e, n, r) {
    t(71);
  }
  exportDOM(t) {
    return { element: this.createDOM(t._config, t) };
  }
  exportJSON() {
    const t = this.__state ? this.__state.toJSON() : void 0;
    return { type: this.__type, version: 1, ...t };
  }
  static importJSON(e) {
    t(18, this.name);
  }
  updateFromJSON(t) {
    return (function (t, e) {
      const n = t.getWritable(),
        r = e.$;
      let o = r;
      for (const t of tt(n).flatKeys)
        t in e && ((void 0 !== o && o !== r) || (o = { ...r }), (o[t] = e[t]));
      return ((n.__state || o) && Z(t).updateFromJSON(o), n);
    })(this, t);
  }
  static transform() {
    return null;
  }
  remove(t) {
    Tn(this, !0, t);
  }
  replace(e, n) {
    Ur();
    let r = kr();
    (null !== r && (r = r.clone()), zi(this, e));
    const o = this.getLatest(),
      i = this.__key,
      s = e.__key,
      l = e.getWritable(),
      c = this.getParentOrThrow().getWritable(),
      a = c.__size;
    Ho(l);
    const u = o.getPreviousSibling(),
      f = o.getNextSibling(),
      d = o.__prev,
      h = o.__next,
      g = o.__parent;
    if ((Tn(o, !1, !0), null === u)) c.__first = s;
    else {
      u.getWritable().__next = s;
    }
    if (((l.__prev = d), null === f)) c.__last = s;
    else {
      f.getWritable().__prev = s;
    }
    if (
      ((l.__next = h),
      (l.__parent = g),
      (c.__size = a),
      n &&
        ((co(this) && co(l)) || t(139),
        this.getChildren().forEach((t) => {
          l.append(t);
        })),
      ar(r))
    ) {
      ii(r);
      const t = r.anchor,
        e = r.focus;
      (t.key === i && lr(t, l), e.key === i && lr(e, l));
    }
    return (qo() === i && Go(s), l);
  }
  insertAfter(t, e = !0) {
    (Ur(), zi(this, t));
    const n = this.getWritable(),
      r = t.getWritable(),
      o = r.getParent(),
      i = kr();
    let s = !1,
      l = !1;
    if (null !== o) {
      const e = t.getIndexWithinParent();
      if ((Ho(r), ar(i))) {
        const t = o.__key,
          n = i.anchor,
          r = i.focus;
        ((s = 'element' === n.type && n.key === t && n.offset === e + 1),
          (l = 'element' === r.type && r.key === t && r.offset === e + 1));
      }
    }
    const c = this.getNextSibling(),
      a = this.getParentOrThrow().getWritable(),
      u = r.__key,
      f = n.__next;
    if (null === c) a.__last = u;
    else {
      c.getWritable().__prev = u;
    }
    if (
      (a.__size++,
      (n.__next = u),
      (r.__next = f),
      (r.__prev = n.__key),
      (r.__parent = n.__parent),
      e && ar(i))
    ) {
      const t = this.getIndexWithinParent();
      Or(i, a, t + 1);
      const e = a.__key;
      (s && i.anchor.set(e, t + 2, 'element'), l && i.focus.set(e, t + 2, 'element'));
    }
    return t;
  }
  insertBefore(t, e = !0) {
    (Ur(), zi(this, t));
    const n = this.getWritable(),
      r = t.getWritable(),
      o = r.__key;
    Ho(r);
    const i = this.getPreviousSibling(),
      s = this.getParentOrThrow().getWritable(),
      l = n.__prev,
      c = this.getIndexWithinParent();
    if (null === i) s.__first = o;
    else {
      i.getWritable().__next = o;
    }
    (s.__size++, (n.__prev = o), (r.__prev = l), (r.__next = n.__key), (r.__parent = n.__parent));
    const a = kr();
    if (e && ar(a)) {
      Or(a, this.getParentOrThrow(), c);
    }
    return t;
  }
  isParentRequired() {
    return !1;
  }
  createParentElementNode() {
    return No();
  }
  selectStart() {
    return this.selectPrevious();
  }
  selectEnd() {
    return this.selectNext(0, 0);
  }
  selectPrevious(t, e) {
    Ur();
    const n = this.getPreviousSibling(),
      r = this.getParentOrThrow();
    if (null === n) return r.select(0, 0);
    if (co(n)) return n.select();
    if (!Zn(n)) {
      const t = n.getIndexWithinParent() + 1;
      return r.select(t, t);
    }
    return n.select(t, e);
  }
  selectNext(t, e) {
    Ur();
    const n = this.getNextSibling(),
      r = this.getParentOrThrow();
    if (null === n) return r.select();
    if (co(n)) return n.select(0, 0);
    if (!Zn(n)) {
      const t = n.getIndexWithinParent();
      return r.select(t, t);
    }
    return n.select(t, e);
  }
  markDirty() {
    this.getWritable();
  }
  reconcileObservedMutation(t, e) {
    this.markDirty();
  }
}
const On = 'history-merge',
  bn = 'collaboration',
  Mn = 'skip-scroll-into-view',
  An = 'skip-dom-selection',
  wn = 'skip-selection-focus';
class Dn extends En {
  static getType() {
    return 'linebreak';
  }
  static clone(t) {
    return new Dn(t.__key);
  }
  constructor(t) {
    super(t);
  }
  getTextContent() {
    return '\n';
  }
  createDOM() {
    return document.createElement('br');
  }
  updateDOM() {
    return !1;
  }
  isInline() {
    return !0;
  }
  static importDOM() {
    return {
      br: (t) =>
        (function (t) {
          const e = t.parentElement;
          if (null !== e && qi(e)) {
            const n = e.firstChild;
            if (n === t || (n.nextSibling === t && Fn(n))) {
              const n = e.lastChild;
              if (n === t || (n.previousSibling === t && Fn(n))) return !0;
            }
          }
          return !1;
        })(t) ||
        (function (t) {
          const e = t.parentElement;
          if (null !== e && qi(e)) {
            const n = e.firstChild;
            if (n === t || (n.nextSibling === t && Fn(n))) return !1;
            const r = e.lastChild;
            if (r === t || (r.previousSibling === t && Fn(r))) return !0;
          }
          return !1;
        })(t)
          ? null
          : { conversion: Pn, priority: 0 },
    };
  }
  static importJSON(t) {
    return In().updateFromJSON(t);
  }
}
function Pn(t) {
  return { node: In() };
}
function In() {
  return Bi(new Dn());
}
function Ln(t) {
  return t instanceof Dn;
}
function Fn(t) {
  return $o(t) && /^( |\t|\r?\n)+$/.test(t.textContent || '');
}
function Rn(t, e) {
  return 16 & e ? 'code' : e & y ? 'mark' : 32 & e ? 'sub' : 64 & e ? 'sup' : null;
}
function Kn(t, e) {
  return 1 & e ? 'strong' : 2 & e ? 'em' : 'span';
}
function Bn(t, e, n, r, o) {
  const i = r.classList;
  let s = Si(o, 'base');
  (void 0 !== s && i.add(...s), (s = Si(o, 'underlineStrikethrough')));
  let l = !1;
  const c = 8 & e && 4 & e;
  void 0 !== s && (8 & n && 4 & n ? ((l = !0), c || i.add(...s)) : c && i.remove(...s));
  for (const t in w) {
    const r = w[t];
    if (((s = Si(o, t)), void 0 !== s))
      if (n & r) {
        if (l && ('underline' === t || 'strikethrough' === t)) {
          e & r && i.remove(...s);
          continue;
        }
        (0 === (e & r) || (c && 'underline' === t) || 'strikethrough' === t) && i.add(...s);
      } else e & r && i.remove(...s);
  }
}
function zn(t, e, n) {
  const r = e.firstChild,
    o = n.isComposing(),
    s = t + (o ? v : '');
  if (null == r) e.textContent = s;
  else {
    const t = r.nodeValue;
    if (t !== s)
      if (o || i) {
        const [e, n, o] = (function (t, e) {
          const n = t.length,
            r = e.length;
          let o = 0,
            i = 0;
          for (; o < n && o < r && t[o] === e[o]; ) o++;
          for (; i + o < n && i + o < r && t[n - i - 1] === e[r - i - 1]; ) i++;
          return [o, n - o - i, e.slice(o, r - i)];
        })(t, s);
        (0 !== n && r.deleteData(e, n), r.insertData(e, o));
      } else r.nodeValue = s;
  }
}
function Wn(t, e, n, r, o, i) {
  zn(o, t, e);
  const s = i.theme.text;
  void 0 !== s && Bn(0, 0, r, t, s);
}
function $n(t, e) {
  const n = document.createElement(e);
  return (n.appendChild(t), n);
}
class Un extends En {
  __text;
  __format;
  __style;
  __mode;
  __detail;
  static getType() {
    return 'text';
  }
  static clone(t) {
    return new Un(t.__text, t.__key);
  }
  afterCloneFrom(t) {
    (super.afterCloneFrom(t),
      (this.__text = t.__text),
      (this.__format = t.__format),
      (this.__style = t.__style),
      (this.__mode = t.__mode),
      (this.__detail = t.__detail));
  }
  constructor(t = '', e) {
    (super(e),
      (this.__text = t),
      (this.__format = 0),
      (this.__style = ''),
      (this.__mode = 0),
      (this.__detail = 0));
  }
  getFormat() {
    return this.getLatest().__format;
  }
  getDetail() {
    return this.getLatest().__detail;
  }
  getMode() {
    const t = this.getLatest();
    return F[t.__mode];
  }
  getStyle() {
    return this.getLatest().__style;
  }
  isToken() {
    return 1 === this.getLatest().__mode;
  }
  isComposing() {
    return this.__key === qo();
  }
  isSegmented() {
    return 2 === this.getLatest().__mode;
  }
  isDirectionless() {
    return !!(1 & this.getLatest().__detail);
  }
  isUnmergeable() {
    return !!(2 & this.getLatest().__detail);
  }
  hasFormat(t) {
    const e = w[t];
    return 0 !== (this.getFormat() & e);
  }
  isSimpleText() {
    return 'text' === this.__type && 0 === this.__mode;
  }
  getTextContent() {
    return this.getLatest().__text;
  }
  getFormatFlags(t, e) {
    return Yo(this.getLatest().__format, t, e);
  }
  canHaveFormat() {
    return !0;
  }
  isInline() {
    return !0;
  }
  createDOM(t, e) {
    const n = this.__format,
      r = Rn(0, n),
      o = Kn(0, n),
      i = null === r ? o : r,
      s = document.createElement(i);
    let l = s;
    (this.hasFormat('code') && s.setAttribute('spellcheck', 'false'),
      null !== r && ((l = document.createElement(o)), s.appendChild(l)));
    Wn(l, this, 0, n, this.__text, t);
    const c = this.__style;
    return ('' !== c && (s.style.cssText = c), s);
  }
  updateDOM(e, n, r) {
    const o = this.__text,
      i = e.__format,
      s = this.__format,
      l = Rn(0, i),
      c = Rn(0, s),
      a = Kn(0, i),
      u = Kn(0, s);
    if ((null === l ? a : l) !== (null === c ? u : c)) return !0;
    if (l === c && a !== u) {
      const e = n.firstChild;
      null == e && t(48);
      const i = document.createElement(u);
      return (Wn(i, this, 0, s, o, r), n.replaceChild(i, e), !1);
    }
    let f = n;
    (null !== c && null !== l && ((f = n.firstChild), null == f && t(49)), zn(o, f, this));
    const d = r.theme.text;
    void 0 !== d && i !== s && Bn(0, i, s, f, d);
    const h = e.__style,
      g = this.__style;
    return (h !== g && (n.style.cssText = g), !1);
  }
  static importDOM() {
    return {
      '#text': () => ({ conversion: Vn, priority: 0 }),
      'b': () => ({ conversion: Yn, priority: 0 }),
      'code': () => ({ conversion: Xn, priority: 0 }),
      'em': () => ({ conversion: Xn, priority: 0 }),
      'i': () => ({ conversion: Xn, priority: 0 }),
      'mark': () => ({ conversion: Xn, priority: 0 }),
      's': () => ({ conversion: Xn, priority: 0 }),
      'span': () => ({ conversion: Jn, priority: 0 }),
      'strong': () => ({ conversion: Xn, priority: 0 }),
      'sub': () => ({ conversion: Xn, priority: 0 }),
      'sup': () => ({ conversion: Xn, priority: 0 }),
      'u': () => ({ conversion: Xn, priority: 0 }),
    };
  }
  static importJSON(t) {
    return Qn().updateFromJSON(t);
  }
  updateFromJSON(t) {
    return super
      .updateFromJSON(t)
      .setTextContent(t.text)
      .setFormat(t.format)
      .setDetail(t.detail)
      .setMode(t.mode)
      .setStyle(t.style);
  }
  exportDOM(e) {
    let { element: n } = super.exportDOM(e);
    return (
      ji(n) || t(132),
      (n.style.whiteSpace = 'pre-wrap'),
      this.hasFormat('lowercase')
        ? (n.style.textTransform = 'lowercase')
        : this.hasFormat('uppercase')
          ? (n.style.textTransform = 'uppercase')
          : this.hasFormat('capitalize') && (n.style.textTransform = 'capitalize'),
      this.hasFormat('bold') && (n = $n(n, 'b')),
      this.hasFormat('italic') && (n = $n(n, 'i')),
      this.hasFormat('strikethrough') && (n = $n(n, 's')),
      this.hasFormat('underline') && (n = $n(n, 'u')),
      { element: n }
    );
  }
  exportJSON() {
    return {
      detail: this.getDetail(),
      format: this.getFormat(),
      mode: this.getMode(),
      style: this.getStyle(),
      text: this.getTextContent(),
      ...super.exportJSON(),
    };
  }
  selectionTransform(t, e) {}
  setFormat(t) {
    const e = this.getWritable();
    return ((e.__format = 'string' == typeof t ? w[t] : t), e);
  }
  setDetail(t) {
    const e = this.getWritable();
    return ((e.__detail = 'string' == typeof t ? D[t] : t), e);
  }
  setStyle(t) {
    const e = this.getWritable();
    return ((e.__style = t), e);
  }
  toggleFormat(t) {
    const e = Yo(this.getFormat(), t, null);
    return this.setFormat(e);
  }
  toggleDirectionless() {
    const t = this.getWritable();
    return ((t.__detail ^= 1), t);
  }
  toggleUnmergeable() {
    const t = this.getWritable();
    return ((t.__detail ^= 2), t);
  }
  setMode(t) {
    const e = L[t];
    if (this.__mode === e) return this;
    const n = this.getWritable();
    return ((n.__mode = e), n);
  }
  setTextContent(t) {
    if (this.__text === t) return this;
    const e = this.getWritable();
    return ((e.__text = t), e);
  }
  select(t, e) {
    Ur();
    let n = t,
      r = e;
    const o = kr(),
      i = this.getTextContent(),
      s = this.__key;
    if ('string' == typeof i) {
      const t = i.length;
      (void 0 === n && (n = t), void 0 === r && (r = t));
    } else ((n = 0), (r = 0));
    if (!ar(o)) return Sr(s, n, s, r, 'text', 'text');
    {
      const t = qo();
      ((t !== o.anchor.key && t !== o.focus.key) || Go(s), o.setTextNodeRange(this, n, this, r));
    }
    return o;
  }
  selectStart() {
    return this.select(0, 0);
  }
  selectEnd() {
    const t = this.getTextContentSize();
    return this.select(t, t);
  }
  spliceText(t, e, n, r) {
    const o = this.getWritable(),
      i = o.__text,
      s = n.length;
    let l = t;
    l < 0 && ((l = s + l), l < 0 && (l = 0));
    const c = kr();
    if (r && ar(c)) {
      const e = t + s;
      c.setTextNodeRange(o, e, o, e);
    }
    const a = i.slice(0, l) + n + i.slice(l + e);
    return ((o.__text = a), o);
  }
  canInsertTextBefore() {
    return !0;
  }
  canInsertTextAfter() {
    return !0;
  }
  splitText(...t) {
    Ur();
    const e = this.getLatest(),
      n = e.getTextContent();
    if ('' === n) return [];
    const r = e.__key,
      o = qo(),
      i = n.length;
    (t.sort((t, e) => t - e), t.push(i));
    const s = [],
      l = t.length;
    for (let e = 0, r = 0; e < i && r <= l; r++) {
      const o = t[r];
      o > e && (s.push(n.slice(e, o)), (e = o));
    }
    const c = s.length;
    if (1 === c) return [e];
    const a = s[0],
      u = e.getParent();
    let f;
    const d = e.getFormat(),
      h = e.getStyle(),
      g = e.__detail;
    let _ = !1,
      p = null,
      y = null;
    const m = kr();
    if (ar(m)) {
      const [t, e] = m.isBackward() ? [m.focus, m.anchor] : [m.anchor, m.focus];
      ('text' === t.type && t.key === r && (p = t), 'text' === e.type && e.key === r && (y = e));
    }
    e.isSegmented()
      ? ((f = Qn(a)),
        (f.__format = d),
        (f.__style = h),
        (f.__detail = g),
        (f.__state = it(e, f)),
        (_ = !0))
      : (f = e.setTextContent(a));
    const x = [f];
    for (let t = 1; t < c; t++) {
      const n = Qn(s[t]);
      ((n.__format = d), (n.__style = h), (n.__detail = g), (n.__state = it(e, n)));
      const i = n.__key;
      (o === r && Go(i), x.push(n));
    }
    const C = p ? p.offset : null,
      S = y ? y.offset : null;
    let N = 0;
    for (const t of x) {
      if (!p && !y) break;
      const e = N + t.getTextContentSize();
      if (
        (null !== p &&
          null !== C &&
          C <= e &&
          C >= N &&
          (p.set(t.getKey(), C - N, 'text'), C < e && (p = null)),
        null !== y && null !== S && S <= e && S >= N)
      ) {
        y.set(t.getKey(), S - N, 'text');
        break;
      }
      N = e;
    }
    if (null !== u) {
      !(function (t) {
        const e = t.getPreviousSibling(),
          n = t.getNextSibling();
        null !== e && Vo(e);
        null !== n && Vo(n);
      })(this);
      const t = u.getWritable(),
        e = this.getIndexWithinParent();
      (_ ? (t.splice(e, 0, x), this.remove()) : t.splice(e, 1, x), ar(m) && Or(m, u, e, c - 1));
    }
    return x;
  }
  mergeWithSibling(e) {
    const n = e === this.getPreviousSibling();
    n || e === this.getNextSibling() || t(50);
    const r = this.__key,
      o = e.__key,
      i = this.__text,
      s = i.length;
    qo() === o && Go(r);
    const l = kr();
    if (ar(l)) {
      const t = l.anchor,
        i = l.focus;
      (null !== t && t.key === o && Ar(t, n, r, e, s),
        null !== i && i.key === o && Ar(i, n, r, e, s));
    }
    const c = e.__text,
      a = n ? c + i : i + c;
    this.setTextContent(a);
    const u = this.getWritable();
    return (e.remove(), u);
  }
  isTextEntity() {
    return !1;
  }
}
function Jn(t) {
  return { forChild: tr(t.style), node: null };
}
function Yn(t) {
  const e = t,
    n = 'normal' === e.style.fontWeight;
  return { forChild: tr(e.style, n ? void 0 : 'bold'), node: null };
}
const jn = new WeakMap();
function Hn(t) {
  if (!ji(t)) return !1;
  if ('PRE' === t.nodeName) return !0;
  const e = t.style.whiteSpace;
  return 'string' == typeof e && e.startsWith('pre');
}
function Vn(e) {
  const n = e;
  null === e.parentElement && t(129);
  let r = n.textContent || '';
  if (
    null !==
    (function (t) {
      let e,
        n = t.parentNode;
      const r = [t];
      for (; null !== n && void 0 === (e = jn.get(n)) && !Hn(n); ) (r.push(n), (n = n.parentNode));
      const o = void 0 === e ? n : e;
      for (let t = 0; t < r.length; t++) jn.set(r[t], o);
      return o;
    })(n)
  ) {
    const t = r.split(/(\r?\n|\t)/),
      e = [],
      n = t.length;
    for (let r = 0; r < n; r++) {
      const n = t[r];
      '\n' === n || '\r\n' === n
        ? e.push(In())
        : '\t' === n
          ? e.push(nr())
          : '' !== n && e.push(Qn(n));
    }
    return { node: e };
  }
  if (((r = r.replace(/\r/g, '').replace(/[ \t\n]+/g, ' ')), '' === r)) return { node: null };
  if (' ' === r[0]) {
    let t = n,
      e = !0;
    for (; null !== t && null !== (t = Gn(t, !1)); ) {
      const n = t.textContent || '';
      if (n.length > 0) {
        (/[ \t\n]$/.test(n) && (r = r.slice(1)), (e = !1));
        break;
      }
    }
    e && (r = r.slice(1));
  }
  if (' ' === r[r.length - 1]) {
    let t = n,
      e = !0;
    for (; null !== t && null !== (t = Gn(t, !0)); ) {
      if ((t.textContent || '').replace(/^( |\t|\r?\n)+/, '').length > 0) {
        e = !1;
        break;
      }
    }
    e && (r = r.slice(0, r.length - 1));
  }
  return '' === r ? { node: null } : { node: Qn(r) };
}
function Gn(t, e) {
  let n = t;
  for (;;) {
    let t;
    for (; null === (t = e ? n.nextSibling : n.previousSibling); ) {
      const t = n.parentElement;
      if (null === t) return null;
      n = t;
    }
    if (((n = t), ji(n))) {
      const t = n.style.display;
      if (('' === t && !Gi(n)) || ('' !== t && !t.startsWith('inline'))) return null;
    }
    let r = n;
    for (; null !== (r = e ? n.firstChild : n.lastChild); ) n = r;
    if ($o(n)) return n;
    if ('BR' === n.nodeName) return null;
  }
}
const qn = {
  code: 'code',
  em: 'italic',
  i: 'italic',
  mark: 'highlight',
  s: 'strikethrough',
  strong: 'bold',
  sub: 'subscript',
  sup: 'superscript',
  u: 'underline',
};
function Xn(t) {
  const e = qn[t.nodeName.toLowerCase()];
  return void 0 === e ? { node: null } : { forChild: tr(t.style, e), node: null };
}
function Qn(t = '') {
  return Bi(new Un(t));
}
function Zn(t) {
  return t instanceof Un;
}
function tr(t, e) {
  const n = t.fontWeight,
    r = t.textDecoration.split(' '),
    o = '700' === n || 'bold' === n,
    i = r.includes('line-through'),
    s = 'italic' === t.fontStyle,
    l = r.includes('underline'),
    c = t.verticalAlign;
  return (t) =>
    Zn(t)
      ? (o && !t.hasFormat('bold') && t.toggleFormat('bold'),
        i && !t.hasFormat('strikethrough') && t.toggleFormat('strikethrough'),
        s && !t.hasFormat('italic') && t.toggleFormat('italic'),
        l && !t.hasFormat('underline') && t.toggleFormat('underline'),
        'sub' !== c || t.hasFormat('subscript') || t.toggleFormat('subscript'),
        'super' !== c || t.hasFormat('superscript') || t.toggleFormat('superscript'),
        e && !t.hasFormat(e) && t.toggleFormat(e),
        t)
      : t;
}
class er extends Un {
  static getType() {
    return 'tab';
  }
  static clone(t) {
    return new er(t.__key);
  }
  constructor(t) {
    (super('\t', t), (this.__detail = 2));
  }
  static importDOM() {
    return null;
  }
  createDOM(t) {
    const e = super.createDOM(t),
      n = Si(t.theme, 'tab');
    if (void 0 !== n) {
      e.classList.add(...n);
    }
    return e;
  }
  static importJSON(t) {
    return nr().updateFromJSON(t);
  }
  setTextContent(t) {
    return ('\t' !== t && '' !== t && e(126), super.setTextContent('\t'));
  }
  spliceText(e, n, r, o) {
    return (('' === r && 0 === n) || ('\t' === r && 1 === n) || t(286), this);
  }
  setDetail(e) {
    return (2 !== e && t(127), this);
  }
  setMode(e) {
    return ('normal' !== e && t(128), this);
  }
  canInsertTextBefore() {
    return !1;
  }
  canInsertTextAfter() {
    return !1;
  }
}
function nr() {
  return Bi(new er());
}
function rr(t) {
  return t instanceof er;
}
class or {
  key;
  offset;
  type;
  _selection;
  constructor(t, e, n) {
    ((this._selection = null), (this.key = t), (this.offset = e), (this.type = n));
  }
  is(t) {
    return this.key === t.key && this.offset === t.offset && this.type === t.type;
  }
  isBefore(t) {
    if (this.key === t.key) return this.offset < t.offset;
    return Ls(Gs(zs(this, 'next')), Gs(zs(t, 'next'))) < 0;
  }
  getNode() {
    const e = Xo(this.key);
    return (null === e && t(20), e);
  }
  set(t, e, n, r) {
    const o = this._selection,
      i = this.key;
    (r && this.key === t && this.offset === e && this.type === n) ||
      ((this.key = t),
      (this.offset = e),
      (this.type = n),
      $r() || (qo() === i && Go(t), null !== o && (o.setCachedNodes(null), (o.dirty = !0))));
  }
}
function ir(t, e, n) {
  return new or(t, e, n);
}
function sr(t, e) {
  let n = e.__key,
    r = t.offset,
    o = 'element';
  if (Zn(e)) {
    o = 'text';
    const t = e.getTextContentSize();
    r > t && (r = t);
  } else if (!co(e)) {
    const t = e.getNextSibling();
    if (Zn(t)) ((n = t.__key), (r = 0), (o = 'text'));
    else {
      const t = e.getParent();
      t && ((n = t.__key), (r = e.getIndexWithinParent() + 1));
    }
  }
  t.set(n, r, o);
}
function lr(t, e) {
  if (co(e)) {
    const n = e.getLastDescendant();
    co(n) || Zn(n) ? sr(t, n) : sr(t, e);
  } else sr(t, e);
}
class cr {
  _nodes;
  _cachedNodes;
  dirty;
  constructor(t) {
    ((this._cachedNodes = null), (this._nodes = t), (this.dirty = !1));
  }
  getCachedNodes() {
    return this._cachedNodes;
  }
  setCachedNodes(t) {
    this._cachedNodes = t;
  }
  is(t) {
    if (!fr(t)) return !1;
    const e = this._nodes,
      n = t._nodes;
    return e.size === n.size && Array.from(e).every((t) => n.has(t));
  }
  isCollapsed() {
    return !1;
  }
  isBackward() {
    return !1;
  }
  getStartEndPoints() {
    return null;
  }
  add(t) {
    ((this.dirty = !0), this._nodes.add(t), (this._cachedNodes = null));
  }
  delete(t) {
    ((this.dirty = !0), this._nodes.delete(t), (this._cachedNodes = null));
  }
  clear() {
    ((this.dirty = !0), this._nodes.clear(), (this._cachedNodes = null));
  }
  has(t) {
    return this._nodes.has(t);
  }
  clone() {
    return new cr(new Set(this._nodes));
  }
  extract() {
    return this.getNodes();
  }
  insertRawText(t) {}
  insertText() {}
  insertNodes(t) {
    const e = this.getNodes(),
      n = e.length,
      r = e[n - 1];
    let o;
    if (Zn(r)) o = r.select();
    else {
      const t = r.getIndexWithinParent() + 1;
      o = r.getParentOrThrow().select(t, t);
    }
    o.insertNodes(t);
    for (let t = 0; t < n; t++) e[t].remove();
  }
  getNodes() {
    const t = this._cachedNodes;
    if (null !== t) return t;
    const e = this._nodes,
      n = [];
    for (const t of e) {
      const e = Xo(t);
      null !== e && n.push(e);
    }
    return ($r() || (this._cachedNodes = n), n);
  }
  getTextContent() {
    const t = this.getNodes();
    let e = '';
    for (let n = 0; n < t.length; n++) e += t[n].getTextContent();
    return e;
  }
  deleteNodes() {
    const t = this.getNodes();
    if ((kr() || Er()) === this && t[0]) {
      const e = Ns(t[0], 'next');
      $s(Ps(e, e));
    }
    for (const e of t) e.remove();
  }
}
function ar(t) {
  return t instanceof ur;
}
class ur {
  format;
  style;
  anchor;
  focus;
  _cachedNodes;
  dirty;
  constructor(t, e, n, r) {
    ((this.anchor = t),
      (this.focus = e),
      (t._selection = this),
      (e._selection = this),
      (this._cachedNodes = null),
      (this.format = n),
      (this.style = r),
      (this.dirty = !1));
  }
  getCachedNodes() {
    return this._cachedNodes;
  }
  setCachedNodes(t) {
    this._cachedNodes = t;
  }
  is(t) {
    return (
      !!ar(t) &&
      this.anchor.is(t.anchor) &&
      this.focus.is(t.focus) &&
      this.format === t.format &&
      this.style === t.style
    );
  }
  isCollapsed() {
    return this.anchor.is(this.focus);
  }
  getNodes() {
    const t = this._cachedNodes;
    if (null !== t) return t;
    const e = (function (t) {
      const e = [],
        [n, r] = t.getTextSlices();
      n && e.push(n.caret.origin);
      const o = new Set(),
        i = new Set();
      for (const n of t)
        if (ms(n)) {
          const { origin: t } = n;
          0 === e.length ? o.add(t) : (i.add(t), e.push(t));
        } else {
          const { origin: t } = n;
          (co(t) && i.has(t)) || e.push(t);
        }
      r && e.push(r.caret.origin);
      if (ys(t.focus) && co(t.focus.origin) && null === t.focus.getNodeAtCaret())
        for (
          let n = Es(t.focus.origin, 'previous');
          ms(n) && o.has(n.origin) && !n.origin.isEmpty() && n.origin.is(e[e.length - 1]);
          n = bs(n)
        )
          (o.delete(n.origin), e.pop());
      for (; e.length > 1; ) {
        const t = e[e.length - 1];
        if (!co(t) || i.has(t) || t.isEmpty() || o.has(t)) break;
        e.pop();
      }
      if (0 === e.length && t.isCollapsed()) {
        const n = Gs(t.anchor),
          r = Gs(t.anchor.getFlipped()),
          o = (t) => (ps(t) ? t.origin : t.getNodeAtCaret()),
          i = o(n) || o(r) || (t.anchor.getNodeAtCaret() ? n.origin : r.origin);
        e.push(i);
      }
      return e;
    })(Qs(Js(this), 'next'));
    return ($r() || (this._cachedNodes = e), e);
  }
  setTextNodeRange(t, e, n, r) {
    (this.anchor.set(t.__key, e, 'text'), this.focus.set(n.__key, r, 'text'));
  }
  getTextContent() {
    const t = this.getNodes();
    if (0 === t.length) return '';
    const e = t[0],
      n = t[t.length - 1],
      r = this.anchor,
      o = this.focus,
      i = r.isBefore(o),
      [s, l] = hr(this);
    let c = '',
      a = !0;
    for (let u = 0; u < t.length; u++) {
      const f = t[u];
      if (co(f) && !f.isInline()) (a || (c += '\n'), (a = !f.isEmpty()));
      else if (((a = !1), Zn(f))) {
        let t = f.getTextContent();
        (f === e
          ? f === n
            ? ('element' === r.type && 'element' === o.type && o.offset !== r.offset) ||
              (t = s < l ? t.slice(s, l) : t.slice(l, s))
            : (t = i ? t.slice(s) : t.slice(l))
          : f === n && (t = i ? t.slice(0, l) : t.slice(0, s)),
          (c += t));
      } else (!fo(f) && !Ln(f)) || (f === n && this.isCollapsed()) || (c += f.getTextContent());
    }
    return c;
  }
  applyDOMRange(t) {
    const e = jr(),
      n = e.getEditorState()._selection,
      r = Cr(t.startContainer, t.startOffset, t.endContainer, t.endOffset, e, n);
    if (null === r) return;
    const [o, i] = r;
    (this.anchor.set(o.key, o.offset, o.type, !0),
      this.focus.set(i.key, i.offset, i.type, !0),
      at(this));
  }
  clone() {
    const t = this.anchor,
      e = this.focus;
    return new ur(
      ir(t.key, t.offset, t.type),
      ir(e.key, e.offset, e.type),
      this.format,
      this.style,
    );
  }
  toggleFormat(t) {
    ((this.format = Yo(this.format, t, null)), (this.dirty = !0));
  }
  setFormat(t) {
    ((this.format = t), (this.dirty = !0));
  }
  setStyle(t) {
    ((this.style = t), (this.dirty = !0));
  }
  hasFormat(t) {
    const e = w[t];
    return 0 !== (this.format & e);
  }
  insertRawText(t) {
    const e = t.split(/(\r?\n|\t)/),
      n = [],
      r = e.length;
    for (let t = 0; t < r; t++) {
      const r = e[t];
      '\n' === r || '\r\n' === r ? n.push(In()) : '\t' === r ? n.push(nr()) : n.push(Qn(r));
    }
    this.insertNodes(n);
  }
  insertText(e) {
    const n = this.anchor,
      r = this.focus,
      o = this.format,
      i = this.style;
    let s = n,
      l = r;
    (!this.isCollapsed() && r.isBefore(n) && ((s = r), (l = n)),
      'element' === s.type &&
        (function (t, e, n, r) {
          const o = t.getNode(),
            i = o.getChildAtIndex(t.offset),
            s = Qn();
          if ((s.setFormat(n), s.setStyle(r), To(i))) i.splice(0, 0, [s]);
          else {
            const t = go(o) ? No().append(s) : s;
            null === i ? o.append(t) : i.insertBefore(t);
          }
          (t.is(e) && e.set(s.__key, 0, 'text'), t.set(s.__key, 0, 'text'));
        })(s, l, o, i),
      'element' === l.type && Ws(l, Gs(zs(l, 'next'))));
    const c = s.offset;
    let a = l.offset;
    const u = this.getNodes(),
      f = u.length;
    let d = u[0];
    Zn(d) || t(26);
    const h = d.getTextContent().length,
      g = d.getParentOrThrow();
    let _ = u[f - 1];
    if (
      (1 === f && 'element' === l.type && ((a = h), l.set(s.key, a, 'text')),
      this.isCollapsed() &&
        c === h &&
        (Wo(d) ||
          !d.canInsertTextAfter() ||
          (!g.canInsertTextAfter() && null === d.getNextSibling())))
    ) {
      let t = d.getNextSibling();
      if (
        ((Zn(t) && t.canInsertTextBefore() && !Wo(t)) ||
          ((t = Qn()),
          t.setFormat(o),
          t.setStyle(i),
          g.canInsertTextAfter() ? d.insertAfter(t) : g.insertAfter(t)),
        t.select(0, 0),
        (d = t),
        '' !== e)
      )
        return void this.insertText(e);
    } else if (
      this.isCollapsed() &&
      0 === c &&
      (Wo(d) ||
        !d.canInsertTextBefore() ||
        (!g.canInsertTextBefore() && null === d.getPreviousSibling()))
    ) {
      let t = d.getPreviousSibling();
      if (
        ((Zn(t) && !Wo(t)) ||
          ((t = Qn()),
          t.setFormat(o),
          g.canInsertTextBefore() ? d.insertBefore(t) : g.insertBefore(t)),
        t.select(),
        (d = t),
        '' !== e)
      )
        return void this.insertText(e);
    } else if (d.isSegmented() && c !== h) {
      const t = Qn(d.getTextContent());
      (t.setFormat(o), d.replace(t), (d = t));
    } else if (!this.isCollapsed() && '' !== e) {
      const t = _.getParent();
      if (
        !g.canInsertTextBefore() ||
        !g.canInsertTextAfter() ||
        (co(t) && (!t.canInsertTextBefore() || !t.canInsertTextAfter()))
      )
        return (this.insertText(''), xr(this.anchor, this.focus, null), void this.insertText(e));
    }
    if (1 === f) {
      if (zo(d)) {
        const t = Qn(e);
        return (t.select(), void d.replace(t));
      }
      const t = d.getFormat(),
        n = d.getStyle();
      if (c !== a || (t === o && n === i)) {
        if (rr(d)) {
          const t = Qn(e);
          return (t.setFormat(o), t.setStyle(i), t.select(), void d.replace(t));
        }
      } else {
        if ('' !== d.getTextContent()) {
          const t = Qn(e);
          if ((t.setFormat(o), t.setStyle(i), t.select(), 0 === c)) d.insertBefore(t, !1);
          else {
            const [e] = d.splitText(c);
            e.insertAfter(t, !1);
          }
          return void (
            t.isComposing() &&
            'text' === this.anchor.type &&
            (this.anchor.offset -= e.length)
          );
        }
        (d.setFormat(o), d.setStyle(i));
      }
      const r = a - c;
      ((d = d.spliceText(c, r, e, !0)),
        '' === d.getTextContent()
          ? d.remove()
          : 'text' === this.anchor.type &&
            (d.isComposing()
              ? (this.anchor.offset -= e.length)
              : ((this.format = t), (this.style = n))));
    } else {
      const t = new Set([...d.getParentKeys(), ..._.getParentKeys()]),
        n = co(d) ? d : d.getParentOrThrow();
      let r = co(_) ? _ : _.getParentOrThrow(),
        o = _;
      if (!n.is(r) && r.isInline())
        do {
          ((o = r), (r = r.getParentOrThrow()));
        } while (r.isInline());
      if (
        ('text' === l.type && (0 !== a || '' === _.getTextContent())) ||
        ('element' === l.type && _.getIndexWithinParent() < a)
      )
        if (Zn(_) && !zo(_) && a !== _.getTextContentSize()) {
          if (_.isSegmented()) {
            const t = Qn(_.getTextContent());
            (_.replace(t), (_ = t));
          }
          (go(l.getNode()) || 'text' !== l.type || (_ = _.spliceText(0, a, '')), t.add(_.__key));
        } else {
          const t = _.getParentOrThrow();
          t.canBeEmpty() || 1 !== t.getChildrenSize() ? _.remove() : t.remove();
        }
      else t.add(_.__key);
      const i = r.getChildren(),
        s = new Set(u),
        g = n.is(r),
        p = n.isInline() && null === d.getNextSibling() ? n : d;
      for (let t = i.length - 1; t >= 0; t--) {
        const e = i[t];
        if (e.is(d) || (co(e) && e.isParentOf(d))) break;
        e.isAttached() && (!s.has(e) || e.is(o) ? g || p.insertAfter(e, !1) : e.remove());
      }
      if (!g) {
        let e = r,
          n = null;
        for (; null !== e; ) {
          const r = e.getChildren(),
            o = r.length;
          ((0 === o || r[o - 1].is(n)) && (t.delete(e.__key), (n = e)), (e = e.getParent()));
        }
      }
      if (zo(d))
        if (c === h) d.select();
        else {
          const t = Qn(e);
          (t.select(), d.replace(t));
        }
      else
        ((d = d.spliceText(c, h - c, e, !0)),
          '' === d.getTextContent()
            ? d.remove()
            : d.isComposing() && 'text' === this.anchor.type && (this.anchor.offset -= e.length));
      for (let e = 1; e < f; e++) {
        const n = u[e],
          r = n.__key;
        t.has(r) || n.remove();
      }
    }
  }
  removeText() {
    const t = kr() === this;
    (Us(this, Vs(Js(this))), t && kr() !== this && ii(this));
  }
  formatText(t, e = null) {
    if (this.isCollapsed()) return (this.toggleFormat(t), void Go(null));
    const n = this.getNodes(),
      r = [];
    for (const t of n) Zn(t) && r.push(t);
    const o = (e) => {
        n.forEach((n) => {
          if (co(n)) {
            const r = n.getFormatFlags(t, e);
            n.setTextFormat(r);
          }
        });
      },
      i = r.length;
    if (0 === i) return (this.toggleFormat(t), Go(null), void o(e));
    const s = this.anchor,
      l = this.focus,
      c = this.isBackward(),
      a = c ? l : s,
      u = c ? s : l;
    let f = 0,
      d = r[0],
      h = 'element' === a.type ? 0 : a.offset;
    if (
      ('text' === a.type && h === d.getTextContentSize() && ((f = 1), (d = r[1]), (h = 0)),
      null == d)
    )
      return;
    const g = d.getFormatFlags(t, e);
    o(g);
    const _ = i - 1;
    let p = r[_];
    const y = 'text' === u.type ? u.offset : p.getTextContentSize();
    if (d.is(p)) {
      if (h === y) return;
      if (Wo(d) || (0 === h && y === d.getTextContentSize())) d.setFormat(g);
      else {
        const t = d.splitText(h, y),
          e = 0 === h ? t[0] : t[1];
        (e.setFormat(g),
          'text' === a.type && a.set(e.__key, 0, 'text'),
          'text' === u.type && u.set(e.__key, y - h, 'text'));
      }
      return void (this.format = g);
    }
    (0 === h || Wo(d) || (([, d] = d.splitText(h)), (h = 0)), d.setFormat(g));
    const m = p.getFormatFlags(t, g);
    y > 0 && (y === p.getTextContentSize() || Wo(p) || ([p] = p.splitText(y)), p.setFormat(m));
    for (let e = f + 1; e < _; e++) {
      const n = r[e],
        o = n.getFormatFlags(t, m);
      n.setFormat(o);
    }
    ('text' === a.type && a.set(d.__key, h, 'text'),
      'text' === u.type && u.set(p.__key, y, 'text'),
      (this.format = g | m));
  }
  insertNodes(e) {
    if (0 === e.length) return;
    if ((this.isCollapsed() || this.removeText(), 'root' === this.anchor.key)) {
      this.insertParagraph();
      const n = kr();
      return (ar(n) || t(134), n.insertNodes(e));
    }
    const n = (this.isBackward() ? this.focus : this.anchor).getNode(),
      r = ls(n, Xi),
      o = e[e.length - 1];
    if (co(r) && '__language' in r) {
      if ('__language' in e[0]) this.insertText(e[0].getTextContent());
      else {
        const t = Pr(this);
        (r.splice(t, 0, e), o.selectEnd());
      }
      return;
    }
    if (!e.some((t) => (co(t) || fo(t)) && !t.isInline())) {
      co(r) || t(211, n.constructor.name, n.getType());
      const i = Pr(this);
      return (r.splice(i, 0, e), void o.selectEnd());
    }
    const i = (function (t) {
        const e = No();
        let n = null;
        for (let r = 0; r < t.length; r++) {
          const o = t[r],
            i = Ln(o);
          if (
            i ||
            (fo(o) && o.isInline()) ||
            (co(o) && o.isInline()) ||
            Zn(o) ||
            o.isParentRequired()
          ) {
            if (null === n && ((n = o.createParentElementNode()), e.append(n), i)) continue;
            null !== n && n.append(o);
          } else (e.append(o), (n = null));
        }
        return e;
      })(e),
      s = i.getLastDescendant(),
      l = i.getChildren(),
      c = !co(r) || !r.isEmpty() ? this.insertParagraph() : null,
      a = l[l.length - 1];
    let u = l[0];
    var f;
    (co((f = u)) &&
      Xi(f) &&
      !f.isEmpty() &&
      co(r) &&
      (!r.isEmpty() || r.canMergeWhenEmpty()) &&
      (co(r) || t(211, n.constructor.name, n.getType()), r.append(...u.getChildren()), (u = l[1])),
      u &&
        (null === r && t(212, n.constructor.name, n.getType()),
        (function (e, n) {
          const r = n.getParentOrThrow().getLastChild();
          let o = n;
          const i = [n];
          for (; o !== r; ) (o.getNextSibling() || t(140), (o = o.getNextSibling()), i.push(o));
          let s = e;
          for (const t of i) s = s.insertAfter(t);
        })(r, u)));
    const d = ls(s, Xi);
    (c && co(d) && (c.canMergeWhenEmpty() || Xi(a)) && (d.append(...c.getChildren()), c.remove()),
      co(r) && r.isEmpty() && r.remove(),
      s.selectEnd());
    const h = co(r) ? r.getLastChild() : null;
    Ln(h) && d !== r && h.remove();
  }
  insertParagraph() {
    if ('root' === this.anchor.key) {
      const t = No();
      return (ri().splice(this.anchor.offset, 0, [t]), t.select(), t);
    }
    const e = Pr(this),
      n = ls(this.anchor.getNode(), Xi);
    co(n) || t(213);
    const r = n.getChildAtIndex(e),
      o = r ? [r, ...r.getNextSiblings()] : [],
      i = n.insertNewAfter(this, !1);
    return i ? (i.append(...o), i.selectStart(), i) : null;
  }
  insertLineBreak(t) {
    const e = In();
    if ((this.insertNodes([e]), t)) {
      const t = e.getParentOrThrow(),
        n = e.getIndexWithinParent();
      t.select(n, n);
    }
  }
  extract() {
    const t = [...this.getNodes()],
      e = t.length;
    let n = t[0],
      r = t[e - 1];
    const [o, i] = hr(this),
      s = this.isBackward(),
      [l, c] = s ? [this.focus, this.anchor] : [this.anchor, this.focus],
      [a, u] = s ? [i, o] : [o, i];
    if (0 === e) return [];
    if (1 === e) {
      if (Zn(n) && !this.isCollapsed()) {
        const t = n.splitText(a, u),
          e = 0 === a ? t[0] : t[1];
        return e
          ? (l.set(e.getKey(), 0, 'text'), c.set(e.getKey(), e.getTextContentSize(), 'text'), [e])
          : [];
      }
      return [n];
    }
    if (
      (Zn(n) &&
        (a === n.getTextContentSize()
          ? t.shift()
          : 0 !== a && (([, n] = n.splitText(a)), (t[0] = n), l.set(n.getKey(), 0, 'text'))),
      Zn(r))
    ) {
      const e = r.getTextContent().length;
      0 === u
        ? t.pop()
        : u !== e &&
          (([r] = r.splitText(u)),
          (t[t.length - 1] = r),
          c.set(r.getKey(), r.getTextContentSize(), 'text'));
    }
    return t;
  }
  modify(t, e, n) {
    if (Lr(this, t, e, n)) return;
    const r = 'move' === t,
      o = jr(),
      i = Ji(Li(o));
    if (!i) return;
    const s = o._blockCursorElement,
      l = o._rootElement,
      c = this.focus.getNode();
    if (
      (null === l || null === s || !co(c) || c.isInline() || c.canBeEmpty() || Ui(s, o, l),
      this.dirty)
    ) {
      let t = bi(o, this.anchor.key),
        e = bi(o, this.focus.key);
      ('text' === this.anchor.type && (t = Jo(t)),
        'text' === this.focus.type && (e = Jo(e)),
        t && e && wr(i, t, this.anchor.offset, e, this.focus.offset));
    }
    if (
      ((function (t, e, n, r) {
        t.modify(e, n, r);
      })(i, t, e ? 'backward' : 'forward', n),
      i.rangeCount > 0)
    ) {
      const t = i.getRangeAt(0),
        n = this.anchor.getNode(),
        o = go(n) ? n : Fi(n);
      if ((this.applyDOMRange(t), (this.dirty = !0), !r)) {
        const n = this.getNodes(),
          r = [];
        let s = !1;
        for (let t = 0; t < n.length; t++) {
          const e = n[t];
          Pi(e, o) ? r.push(e) : (s = !0);
        }
        if (s && r.length > 0)
          if (e) {
            const t = r[0];
            co(t) ? t.selectStart() : t.getParentOrThrow().selectStart();
          } else {
            const t = r[r.length - 1];
            co(t) ? t.selectEnd() : t.getParentOrThrow().selectEnd();
          }
        (i.anchorNode === t.startContainer && i.anchorOffset === t.startOffset) ||
          (function (t) {
            const e = t.focus,
              n = t.anchor,
              r = n.key,
              o = n.offset,
              i = n.type;
            (n.set(e.key, e.offset, e.type, !0), e.set(r, o, i, !0));
          })(this);
      }
    }
    'lineboundary' === n && Lr(this, t, e, n, 'decorators');
  }
  forwardDeletion(t, e, n) {
    if (
      !n &&
      (('element' === t.type && co(e) && t.offset === e.getChildrenSize()) ||
        ('text' === t.type && t.offset === e.getTextContentSize()))
    ) {
      const t = e.getParent(),
        n = e.getNextSibling() || (null === t ? null : t.getNextSibling());
      if (co(n) && n.isShadowRoot()) return !0;
    }
    return !1;
  }
  deleteCharacter(t) {
    const e = this.isCollapsed();
    if (this.isCollapsed()) {
      const e = this.anchor;
      let n = e.getNode();
      if (this.forwardDeletion(e, n, t)) return;
      const r = ws(zs(e, t ? 'previous' : 'next'));
      if (r.getTextSlices().every((t) => null === t || 0 === t.distance)) {
        let t = { type: 'initial' };
        for (const e of r.iterNodeCarets('shadowRoot'))
          if (ms(e))
            if (e.origin.isInline());
            else {
              if (e.origin.isShadowRoot()) {
                if ('merge-block' === t.type) break;
                if (co(r.anchor.origin) && r.anchor.origin.isEmpty()) {
                  const t = Gs(e);
                  (Us(this, Ps(t, t)), r.anchor.origin.remove());
                }
                return;
              }
              ('merge-next-block' !== t.type && 'merge-block' !== t.type) ||
                (t = { block: t.block, caret: e, type: 'merge-block' });
            }
          else {
            if ('merge-block' === t.type) break;
            if (ys(e)) {
              if (co(e.origin)) {
                if (e.origin.isInline()) {
                  if (!e.origin.isParentOf(r.anchor.origin)) break;
                } else t = { block: e.origin, type: 'merge-next-block' };
                continue;
              }
              if (fo(e.origin)) {
                if (e.origin.isIsolated());
                else if (
                  'merge-next-block' === t.type &&
                  (e.origin.isKeyboardSelectable() || !e.origin.isInline()) &&
                  co(r.anchor.origin) &&
                  r.anchor.origin.isEmpty()
                ) {
                  r.anchor.origin.remove();
                  const t = Tr();
                  (t.add(e.origin.getKey()), ii(t));
                } else e.origin.remove();
                return;
              }
              break;
            }
          }
        if ('merge-block' === t.type) {
          const { caret: e, block: n } = t;
          return (
            Us(this, Ps(!e.origin.isEmpty() && n.isEmpty() ? Ys(Ns(n, e.direction)) : r.anchor, e)),
            this.removeText()
          );
        }
      }
      const o = this.focus;
      if ((this.modify('extend', t, 'character'), this.isCollapsed())) {
        if (t && 0 === e.offset && gr(this, e.getNode())) return;
      } else {
        const r = 'text' === o.type ? o.getNode() : null;
        if (((n = 'text' === e.type ? e.getNode() : null), null !== r && r.isSegmented())) {
          const e = o.offset,
            i = r.getTextContentSize();
          if (r.is(n) || (t && e !== i) || (!t && 0 !== e)) return void pr(r, t, e);
        } else if (null !== n && n.isSegmented()) {
          const o = e.offset,
            i = n.getTextContentSize();
          if (n.is(r) || (t && 0 !== o) || (!t && o !== i)) return void pr(n, t, o);
        }
        !(function (t, e) {
          const n = t.anchor,
            r = t.focus,
            o = n.getNode(),
            i = r.getNode();
          if (o === i && 'text' === n.type && 'text' === r.type) {
            const t = n.offset,
              i = r.offset,
              s = t < i,
              l = s ? t : i,
              c = s ? i : t,
              a = c - 1;
            if (l !== a) {
              (function (t) {
                return !(li(t) || _r(t));
              })(o.getTextContent().slice(l, c)) &&
                (e ? r.set(r.key, a, r.type) : n.set(n.key, a, n.type));
            }
          }
        })(this, t);
      }
    }
    if (
      (this.removeText(),
      t && !e && this.isCollapsed() && 'element' === this.anchor.type && 0 === this.anchor.offset)
    ) {
      const t = this.anchor.getNode();
      t.isEmpty() && go(t.getParent()) && null === t.getPreviousSibling() && gr(this, t);
    }
  }
  deleteLine(t) {
    (this.isCollapsed() && this.modify('extend', t, 'lineboundary'),
      this.isCollapsed() ? this.deleteCharacter(t) : this.removeText());
  }
  deleteWord(t) {
    if (this.isCollapsed()) {
      const e = this.anchor,
        n = e.getNode();
      if (this.forwardDeletion(e, n, t)) return;
      this.modify('extend', t, 'word');
    }
    this.removeText();
  }
  isBackward() {
    return this.focus.isBefore(this.anchor);
  }
  getStartEndPoints() {
    return [this.anchor, this.focus];
  }
}
function fr(t) {
  return t instanceof cr;
}
function dr(t) {
  const e = t.offset;
  if ('text' === t.type) return e;
  const n = t.getNode();
  return e === n.getChildrenSize() ? n.getTextContent().length : 0;
}
function hr(t) {
  const e = t.getStartEndPoints();
  if (null === e) return [0, 0];
  const [n, r] = e;
  return 'element' === n.type && 'element' === r.type && n.key === r.key && n.offset === r.offset
    ? [0, 0]
    : [dr(n), dr(r)];
}
function gr(t, e) {
  for (let n = e; n; n = n.getParent()) {
    if (co(n)) {
      if (n.collapseAtStart(t)) return !0;
      if (Ri(n)) break;
    }
    if (n.getPreviousSibling()) break;
  }
  return !1;
}
const _r = (() => {
  try {
    const t = new RegExp('\\p{Emoji}', 'u'),
      e = t.test.bind(t);
    if (e('❤️') && e('#️⃣') && e('👍')) return e;
  } catch (t) {}
  return () => !1;
})();
function pr(t, e, n) {
  const r = t,
    o = r.getTextContent().split(/(?=\s)/g),
    i = o.length;
  let s = 0,
    l = 0;
  for (let t = 0; t < i; t++) {
    const r = t === i - 1;
    if (((l = s), (s += o[t].length), (e && s === n) || s > n || r)) {
      (o.splice(t, 1), r && (l = void 0));
      break;
    }
  }
  const c = o.join('').trim();
  '' === c ? r.remove() : (r.setTextContent(c), r.select(l, l));
}
function yr(e, n, r, o) {
  let i,
    s = n;
  if (ji(e)) {
    let l = !1;
    const c = e.childNodes,
      a = c.length,
      u = o._blockCursorElement;
    s === a && ((l = !0), (s = a - 1));
    let f = c[s],
      d = !1;
    if (f === u) ((f = c[s + 1]), (d = !0));
    else if (null !== u) {
      const t = u.parentNode;
      if (e === t) {
        n > Array.prototype.indexOf.call(t.children, u) && s--;
      }
    }
    if (((i = si(f)), Zn(i))) s = vs(i, l ? 'next' : 'previous');
    else {
      let c = si(e);
      if (null === c) return null;
      if (co(c)) {
        const a = o.getElementByKey(c.getKey());
        null === a && t(214);
        const u = c.getDOMSlot(a);
        (([c, s] = u.resolveChildIndex(c, a, e, n)),
          co(c) || t(215),
          l && s >= c.getChildrenSize() && (s = Math.max(0, c.getChildrenSize() - 1)));
        let f = c.getChildAtIndex(s);
        if (
          co(f) &&
          (function (t, e, n) {
            const r = t.getParent();
            return null === n || null === r || !r.canBeEmpty() || r !== n.getNode();
          })(f, 0, r)
        ) {
          const t = l ? f.getLastDescendant() : f.getFirstDescendant();
          (null === t ? (c = f) : ((f = t), (c = co(f) ? f : f.getParentOrThrow())), (s = 0));
        }
        Zn(f)
          ? ((i = f), (c = null), (s = vs(f, l ? 'next' : 'previous')))
          : f !== c && l && !d && (co(c) || t(216), (s = Math.min(c.getChildrenSize(), s + 1)));
      } else {
        const t = c.getIndexWithinParent();
        ((s = 0 === n && fo(c) && si(e) === c ? t : t + 1), (c = c.getParentOrThrow()));
      }
      if (co(c)) return ir(c.__key, s, 'element');
    }
  } else i = si(e);
  return Zn(i) ? ir(i.__key, vs(i, s, 'clamp'), 'text') : null;
}
function mr(t, e, n) {
  const r = t.offset,
    o = t.getNode();
  if (0 === r) {
    const r = o.getPreviousSibling(),
      i = o.getParent();
    if (e) {
      if ((n || !e) && null === r && co(i) && i.isInline()) {
        const e = i.getPreviousSibling();
        Zn(e) && t.set(e.__key, e.getTextContent().length, 'text');
      }
    } else
      co(r) && !n && r.isInline()
        ? t.set(r.__key, r.getChildrenSize(), 'element')
        : Zn(r) && t.set(r.__key, r.getTextContent().length, 'text');
  } else if (r === o.getTextContent().length) {
    const r = o.getNextSibling(),
      i = o.getParent();
    if (e && co(r) && r.isInline()) t.set(r.__key, 0, 'element');
    else if ((n || e) && null === r && co(i) && i.isInline() && !i.canInsertTextAfter()) {
      const e = i.getNextSibling();
      Zn(e) && t.set(e.__key, 0, 'text');
    }
  }
}
function xr(t, e, n) {
  if ('text' === t.type && 'text' === e.type) {
    const r = t.isBefore(e),
      o = t.is(e);
    (mr(t, r, o), mr(e, !r, o), o && e.set(t.key, t.offset, t.type));
    const i = jr();
    if (i.isComposing() && i._compositionKey !== t.key && ar(n)) {
      const r = n.anchor,
        o = n.focus;
      (t.set(r.key, r.offset, r.type, !0), e.set(o.key, o.offset, o.type, !0));
    }
  }
}
function Cr(t, e, n, r, o, i) {
  if (null === t || null === n || !Fo(o, t, n)) return null;
  const s = yr(t, e, ar(i) ? i.anchor : null, o);
  if (null === s) return null;
  const l = yr(n, r, ar(i) ? i.focus : null, o);
  if (null === l) return null;
  if ('element' === s.type && 'element' === l.type) {
    const e = si(t),
      r = si(n);
    if (fo(e) && fo(r)) return null;
  }
  return (xr(s, l, i), [s, l]);
}
function Sr(t, e, n, r, o, i) {
  const s = Yr(),
    l = new ur(ir(t, e, o), ir(n, r, i), 0, '');
  return ((l.dirty = !0), (s._selection = l), l);
}
function Nr() {
  const t = ir('root', 0, 'element'),
    e = ir('root', 0, 'element');
  return new ur(t, e, 0, '');
}
function Tr() {
  return new cr(new Set());
}
function vr(t, e, n, r) {
  const o = n._window;
  if (null === o) return null;
  const i = r || o.event,
    s = i ? i.type : void 0,
    l = 'selectionchange' === s,
    c =
      !B &&
      (l ||
        'beforeinput' === s ||
        'compositionstart' === s ||
        'compositionend' === s ||
        ('click' === s && i && 3 === i.detail) ||
        'drop' === s ||
        void 0 === s);
  let a, u, f, d;
  if (ar(t) && !c) return t.clone();
  if (null === e) return null;
  if (
    ((a = e.anchorNode),
    (u = e.focusNode),
    (f = e.anchorOffset),
    (d = e.focusOffset),
    (l || void 0 === s) && ar(t) && !Fo(n, a, u))
  )
    return t.clone();
  const h = Cr(a, f, u, d, n, t);
  if (null === h) return null;
  const [g, _] = h;
  return new ur(g, _, ar(t) ? t.format : 0, ar(t) ? t.style : '');
}
function kr() {
  return Yr()._selection;
}
function Er() {
  return jr()._editorState._selection;
}
function Or(t, e, n, r = 1) {
  const o = t.anchor,
    i = t.focus,
    s = o.getNode(),
    l = i.getNode();
  if (!e.is(s) && !e.is(l)) return;
  const c = e.__key;
  if (t.isCollapsed()) {
    const e = o.offset;
    if ((n <= e && r > 0) || (n < e && r < 0)) {
      const n = Math.max(0, e + r);
      (o.set(c, n, 'element'), i.set(c, n, 'element'), br(t));
    }
  } else {
    const s = t.isBackward(),
      l = s ? i : o,
      a = l.getNode(),
      u = s ? o : i,
      f = u.getNode();
    if (e.is(a)) {
      const t = l.offset;
      ((n <= t && r > 0) || (n < t && r < 0)) && l.set(c, Math.max(0, t + r), 'element');
    }
    if (e.is(f)) {
      const t = u.offset;
      ((n <= t && r > 0) || (n < t && r < 0)) && u.set(c, Math.max(0, t + r), 'element');
    }
  }
  br(t);
}
function br(t) {
  const e = t.anchor,
    n = e.offset,
    r = t.focus,
    o = r.offset,
    i = e.getNode(),
    s = r.getNode();
  if (t.isCollapsed()) {
    if (!co(i)) return;
    const t = i.getChildrenSize(),
      o = n >= t,
      s = o ? i.getChildAtIndex(t - 1) : i.getChildAtIndex(n);
    if (Zn(s)) {
      let t = 0;
      (o && (t = s.getTextContentSize()), e.set(s.__key, t, 'text'), r.set(s.__key, t, 'text'));
    }
    return;
  }
  if (co(i)) {
    const t = i.getChildrenSize(),
      r = n >= t,
      o = r ? i.getChildAtIndex(t - 1) : i.getChildAtIndex(n);
    if (Zn(o)) {
      let t = 0;
      (r && (t = o.getTextContentSize()), e.set(o.__key, t, 'text'));
    }
  }
  if (co(s)) {
    const t = s.getChildrenSize(),
      e = o >= t,
      n = e ? s.getChildAtIndex(t - 1) : s.getChildAtIndex(o);
    if (Zn(n)) {
      let t = 0;
      (e && (t = n.getTextContentSize()), r.set(n.__key, t, 'text'));
    }
  }
}
function Mr(t, e, n, r, o) {
  let i = null,
    s = 0,
    l = null;
  (null !== r
    ? ((i = r.__key),
      Zn(r)
        ? ((s = r.getTextContentSize()), (l = 'text'))
        : co(r) && ((s = r.getChildrenSize()), (l = 'element')))
    : null !== o && ((i = o.__key), Zn(o) ? (l = 'text') : co(o) && (l = 'element')),
    null !== i && null !== l
      ? t.set(i, s, l)
      : ((s = e.getIndexWithinParent()),
        -1 === s && (s = n.getChildrenSize()),
        t.set(n.__key, s, 'element')));
}
function Ar(t, e, n, r, o) {
  'text' === t.type
    ? t.set(n, t.offset + (e ? 0 : o), 'text')
    : t.offset > r.getIndexWithinParent() && t.set(t.key, t.offset - 1, 'element');
}
function wr(t, e, n, r, o) {
  try {
    t.setBaseAndExtent(e, n, r, o);
  } catch (t) {}
}
function Dr(t, e, n, r, o, i, s) {
  const l = r.anchorNode,
    c = r.focusNode,
    a = r.anchorOffset,
    u = r.focusOffset,
    f = document.activeElement;
  if ((o.has(bn) && f !== i) || (null !== f && Lo(f))) return;
  if (!ar(e)) return void (null !== t && Fo(n, l, c) && r.removeAllRanges());
  const d = e.anchor,
    h = e.focus,
    g = d.key,
    _ = h.key,
    p = bi(n, g),
    y = bi(n, _),
    m = d.offset,
    x = h.offset,
    C = e.format,
    S = e.style,
    N = e.isCollapsed();
  let T = p,
    v = y,
    k = !1;
  if ('text' === d.type) {
    T = Jo(p);
    const t = d.getNode();
    k = t.getFormat() !== C || t.getStyle() !== S;
  } else ar(t) && 'text' === t.anchor.type && (k = !0);
  var E, O, b, M, A;
  if (
    ('text' === h.type && (v = Jo(y)), null !== T && null !== v) &&
    (N &&
      (null === t || k || (ar(t) && (t.format !== C || t.style !== S))) &&
      ((E = C), (O = S), (b = m), (M = g), (A = performance.now()), (nn = [E, O, b, M, A])),
    a !== m ||
      u !== x ||
      l !== T ||
      c !== v ||
      ('Range' === r.type && N) ||
      ((null !== f && i.contains(f)) || o.has(wn) || i.focus({ preventScroll: !0 }),
      'element' === d.type))
  ) {
    if (
      (wr(r, T, m, v, x),
      !o.has(Mn) && e.isCollapsed() && null !== i && i === document.activeElement)
    ) {
      const t =
        ar(e) && 'element' === e.anchor.type
          ? T.childNodes[m] || null
          : r.rangeCount > 0
            ? r.getRangeAt(0)
            : null;
      if (null !== t) {
        let e;
        if (t instanceof Text) {
          const n = document.createRange();
          (n.selectNode(t), (e = n.getBoundingClientRect()));
        } else e = t.getBoundingClientRect();
        !(function (t, e, n) {
          const r = Ai(n),
            o = Ii(r);
          if (null === r || null === o) return;
          let { top: i, bottom: s } = e,
            l = 0,
            c = 0,
            a = n;
          for (; null !== a; ) {
            const e = a === r.body;
            if (e) ((l = 0), (c = Li(t).innerHeight));
            else {
              const t = a.getBoundingClientRect();
              ((l = t.top), (c = t.bottom));
            }
            let n = 0;
            if ((i < l ? (n = -(l - i)) : s > c && (n = s - c), 0 !== n))
              if (e) o.scrollBy(0, n);
              else {
                const t = a.scrollTop;
                a.scrollTop += n;
                const e = a.scrollTop - t;
                ((i -= e), (s -= e));
              }
            if (e) break;
            a = Mi(a);
          }
        })(n, e, i);
      }
    }
    Ge = !0;
  }
}
function Pr(e) {
  let n = e;
  e.isCollapsed() || n.removeText();
  const r = kr();
  (ar(r) && (n = r), ar(n) || t(161));
  const o = n.anchor;
  let i = o.getNode(),
    s = o.offset;
  for (; !Xi(i); ) {
    const t = i;
    if ((([i, s] = Ir(i, s)), t.is(i))) break;
  }
  return s;
}
function Ir(t, e) {
  const n = t.getParent();
  if (!n) {
    const t = No();
    return (ri().append(t), t.select(), [ri(), 0]);
  }
  if (Zn(t)) {
    const r = t.splitText(e);
    if (0 === r.length) return [n, t.getIndexWithinParent()];
    const o = 0 === e ? 0 : 1;
    return [n, r[0].getIndexWithinParent() + o];
  }
  if (!co(t) || 0 === e) return [n, t.getIndexWithinParent()];
  const r = t.getChildAtIndex(e);
  if (r) {
    const n = new ur(ir(t.__key, e, 'element'), ir(t.__key, e, 'element'), 0, ''),
      o = t.insertNewAfter(n);
    o && o.append(r, ...r.getNextSiblings());
  }
  return [n, t.getIndexWithinParent() + 1];
}
function Lr(t, e, n, r, o = 'decorators-and-blocks') {
  if ('move' === e && 'character' === r && !t.isCollapsed()) {
    const [e, r] = n === t.isBackward() ? [t.focus, t.anchor] : [t.anchor, t.focus];
    return (r.set(e.key, e.offset, e.type), !0);
  }
  const i = zs(t.focus, n ? 'previous' : 'next'),
    s = 'lineboundary' === r,
    l = 'move' === e;
  let c = i,
    a = 'decorators-and-blocks' === o;
  if (!qs(c)) {
    for (const t of c) {
      a = !1;
      const { origin: e } = t;
      if (!fo(e) || e.isIsolated() || ((c = t), !s || !e.isInline())) break;
    }
    if (a)
      for (const t of ws(i).iterNodeCarets('extend' === e ? 'shadowRoot' : 'root')) {
        if (ms(t)) t.origin.isInline() || (c = t);
        else {
          if (co(t.origin)) continue;
          fo(t.origin) && !t.origin.isInline() && (c = t);
        }
        break;
      }
  }
  if (c === i) return !1;
  if (l && !s && fo(c.origin) && c.origin.isKeyboardSelectable()) {
    const t = Tr();
    return (t.add(c.origin.getKey()), ii(t), !0);
  }
  return ((c = Gs(c)), l && Ws(t.anchor, c), Ws(t.focus, c), a || !s);
}
let Fr = null,
  Rr = null,
  Kr = !1,
  Br = !1,
  zr = 0;
const Wr = { characterData: !0, childList: !0, subtree: !0 };
function $r() {
  return Kr || (null !== Fr && Fr._readOnly);
}
function Ur() {
  Kr && t(13);
}
function Jr() {
  zr > 99 && t(14);
}
function Yr() {
  return (null === Fr && t(195, Hr()), Fr);
}
function jr() {
  return (null === Rr && t(196, Hr()), Rr);
}
function Hr() {
  let t = 0;
  const e = new Set(),
    n = Oo.version;
  if ('undefined' != typeof window)
    for (const r of document.querySelectorAll('[contenteditable]')) {
      const o = Bo(r);
      if (Ro(o)) t++;
      else if (o) {
        let t = String(o.constructor.version || '<0.17.1');
        (t === n && (t += ' (separately built, likely a bundler configuration issue)'), e.add(t));
      }
    }
  let r = ` Detected on the page: ${t} compatible editor(s) with version ${n}`;
  return (
    e.size && (r += ` and incompatible editors with versions ${Array.from(e).join(', ')}`),
    r
  );
}
function Vr() {
  return Rr;
}
function Gr(t, e, n) {
  const r = e.__type,
    o = wo(t, r);
  let i = n.get(r);
  void 0 === i && ((i = Array.from(o.transforms)), n.set(r, i));
  const s = i.length;
  for (let t = 0; t < s && (i[t](e), e.isAttached()); t++);
}
function qr(t, e) {
  return void 0 !== t && t.__key !== e && t.isAttached();
}
function Xr(t, e) {
  if (!e) return;
  const n = t._updateTags;
  let r = e;
  Array.isArray(e) || (r = [e]);
  for (const t of r) n.add(t);
}
function Qr(e, n) {
  const r = e.type,
    o = n.get(r);
  void 0 === o && t(17, r);
  const i = o.klass;
  e.type !== i.getType() && t(18, i.name);
  const s = i.importJSON(e),
    l = e.children;
  if (co(s) && Array.isArray(l))
    for (let t = 0; t < l.length; t++) {
      const e = Qr(l[t], n);
      s.append(e);
    }
  return s;
}
function Zr(t, e, n) {
  const r = Fr,
    o = Kr,
    i = Rr;
  ((Fr = e), (Kr = !0), (Rr = t));
  try {
    return n();
  } finally {
    ((Fr = r), (Kr = o), (Rr = i));
  }
}
function to(t, e) {
  const n = t._pendingEditorState,
    r = t._rootElement,
    o = t._headless || null === r;
  if (null === n) return;
  const i = t._editorState,
    s = i._selection,
    l = n._selection,
    c = 0 !== t._dirtyType,
    a = Fr,
    u = Kr,
    f = Rr,
    d = t._updating,
    g = t._observer;
  let _ = null;
  if (((t._pendingEditorState = null), (t._editorState = n), !o && c && null !== g)) {
    ((Rr = t), (Fr = n), (Kr = !1), (t._updating = !0));
    try {
      const e = t._dirtyType,
        r = t._dirtyElements,
        o = t._dirtyLeaves;
      (g.disconnect(), (_ = Ut(i, n, t, e, r, o)));
    } catch (e) {
      if ((e instanceof Error && t._onError(e), Br)) throw e;
      return (ko(t, null, r, n), V(t), (t._dirtyType = 2), (Br = !0), to(t, i), void (Br = !1));
    } finally {
      (g.observe(r, Wr), (t._updating = d), (Fr = a), (Kr = u), (Rr = f));
    }
  }
  n._readOnly || (n._readOnly = !0);
  const p = t._dirtyLeaves,
    y = t._dirtyElements,
    m = t._normalizedNodes,
    x = t._updateTags,
    C = t._deferred;
  (c &&
    ((t._dirtyType = 0),
    t._cloneNotNeeded.clear(),
    (t._dirtyLeaves = new Set()),
    (t._dirtyElements = new Map()),
    (t._normalizedNodes = new Set()),
    (t._updateTags = new Set())),
    (function (t, e) {
      const n = t._decorators;
      let r = t._pendingDecorators || n;
      const o = e._nodeMap;
      let i;
      for (i in r) o.has(i) || (r === n && (r = ei(t)), delete r[i]);
    })(t, n));
  const S = o ? null : Ji(Li(t));
  if (
    t._editable &&
    null !== S &&
    (c || null === l || l.dirty || !l.is(s)) &&
    null !== r &&
    !x.has(An)
  ) {
    ((Rr = t), (Fr = n));
    try {
      if ((null !== g && g.disconnect(), c || null === l || l.dirty)) {
        const e = t._blockCursorElement;
        (null !== e && Ui(e, t, r), Dr(s, l, t, S, x, r));
      }
      !(function (t, e, n) {
        let r = t._blockCursorElement;
        if (
          ar(n) &&
          n.isCollapsed() &&
          'element' === n.anchor.type &&
          e.contains(document.activeElement)
        ) {
          const o = n.anchor,
            i = o.getNode(),
            s = o.offset;
          let l = !1,
            c = null;
          if (s === i.getChildrenSize()) {
            $i(i.getChildAtIndex(s - 1)) && (l = !0);
          } else {
            const e = i.getChildAtIndex(s);
            if (null !== e && $i(e)) {
              const n = e.getPreviousSibling();
              (null === n || $i(n)) && ((l = !0), (c = t.getElementByKey(e.__key)));
            }
          }
          if (l) {
            const n = t.getElementByKey(i.__key);
            return (
              null === r &&
                (t._blockCursorElement = r =
                  (function (t) {
                    const e = t.theme,
                      n = document.createElement('div');
                    ((n.contentEditable = 'false'), n.setAttribute('data-lexical-cursor', 'true'));
                    let r = e.blockCursor;
                    if (void 0 !== r) {
                      if ('string' == typeof r) {
                        const t = h(r);
                        r = e.blockCursor = t;
                      }
                      void 0 !== r && n.classList.add(...r);
                    }
                    return n;
                  })(t._config)),
              (e.style.caretColor = 'transparent'),
              void (null === c ? n.appendChild(r) : n.insertBefore(r, c))
            );
          }
        }
        null !== r && Ui(r, t, e);
      })(t, r, l);
    } finally {
      (null !== g && g.observe(r, Wr), (Rr = f), (Fr = a));
    }
  }
  (null !== _ &&
    (function (t, e, n, r, o) {
      const i = Array.from(t._listeners.mutation),
        s = i.length;
      for (let t = 0; t < s; t++) {
        const [s, l] = i[t];
        for (const t of l) {
          const i = e.get(t);
          void 0 !== i && s(i, { dirtyLeaves: r, prevEditorState: o, updateTags: n });
        }
      }
    })(t, _, x, p, i),
    ar(l) || null === l || (null !== s && s.is(l)) || t.dispatchCommand(jt, void 0));
  const N = t._pendingDecorators;
  (null !== N && ((t._decorators = N), (t._pendingDecorators = null), eo('decorator', t, !0, N)),
    (function (t, e, n) {
      const r = ni(e),
        o = ni(n);
      r !== o && eo('textcontent', t, !0, o);
    })(t, e || i, n),
    eo('update', t, !0, {
      dirtyElements: y,
      dirtyLeaves: p,
      editorState: n,
      mutatedNodes: _,
      normalizedNodes: m,
      prevEditorState: e || i,
      tags: x,
    }),
    (function (t, e) {
      if (((t._deferred = []), 0 !== e.length)) {
        const n = t._updating;
        t._updating = !0;
        try {
          for (let t = 0; t < e.length; t++) e[t]();
        } finally {
          t._updating = n;
        }
      }
    })(t, C),
    (function (t) {
      const e = t._updates;
      if (0 !== e.length) {
        const n = e.shift();
        if (n) {
          const [e, r] = n;
          ro(t, e, r);
        }
      }
    })(t));
}
function eo(t, e, n, ...r) {
  const o = e._updating;
  e._updating = n;
  try {
    const n = Array.from(e._listeners[t]);
    for (let t = 0; t < n.length; t++) n[t].apply(null, r);
  } finally {
    e._updating = o;
  }
}
function no(e, n) {
  const r = e._updates;
  let o = n || !1;
  for (; 0 !== r.length; ) {
    const n = r.shift();
    if (n) {
      const [r, i] = n,
        s = e._pendingEditorState;
      let l;
      (void 0 !== i &&
        ((l = i.onUpdate),
        i.skipTransforms && (o = !0),
        i.discrete && (null === s && t(191), (s._flushSync = !0)),
        l && e._deferred.push(l),
        Xr(e, i.tag)),
        null == s ? ro(e, r, i) : r());
    }
  }
  return o;
}
function ro(e, n, r) {
  const o = e._updateTags;
  let i,
    s = !1,
    l = !1;
  (void 0 !== r &&
    ((i = r.onUpdate), Xr(e, r.tag), (s = r.skipTransforms || !1), (l = r.discrete || !1)),
    i && e._deferred.push(i));
  const c = e._editorState;
  let a = e._pendingEditorState,
    u = !1;
  ((null === a || a._readOnly) && ((a = e._pendingEditorState = _o(a || c)), (u = !0)),
    (a._flushSync = l));
  const f = Fr,
    d = Kr,
    h = Rr,
    g = e._updating;
  ((Fr = a), (Kr = !1), (e._updating = !0), (Rr = e));
  const _ = e._headless || null === e.getRootElement();
  Mo(null);
  try {
    u &&
      (_
        ? null !== c._selection && (a._selection = c._selection.clone())
        : (a._selection = (function (t, e) {
            const n = t.getEditorState()._selection,
              r = Ji(Li(t));
            return ar(n) || null == n ? vr(n, r, t, e) : n.clone();
          })(e, (r && r.event) || null)));
    const o = e._compositionKey;
    (n(),
      (s = no(e, s)),
      (function (t, e) {
        const n = e.getEditorState()._selection,
          r = t._selection;
        if (ar(r)) {
          const t = r.anchor,
            e = r.focus;
          let o;
          if (
            ('text' === t.type && ((o = t.getNode()), o.selectionTransform(n, r)),
            'text' === e.type)
          ) {
            const t = e.getNode();
            o !== t && t.selectionTransform(n, r);
          }
        }
      })(a, e),
      0 !== e._dirtyType &&
        (s
          ? (function (t, e) {
              const n = e._dirtyLeaves,
                r = t._nodeMap;
              for (const t of n) {
                const e = r.get(t);
                Zn(e) && e.isAttached() && e.isSimpleText() && !e.isUnmergeable() && ct(e);
              }
            })(a, e)
          : (function (t, e) {
              const n = e._dirtyLeaves,
                r = e._dirtyElements,
                o = t._nodeMap,
                i = qo(),
                s = new Map();
              let l = n,
                c = l.size,
                a = r,
                u = a.size;
              for (; c > 0 || u > 0; ) {
                if (c > 0) {
                  e._dirtyLeaves = new Set();
                  for (const t of l) {
                    const r = o.get(t);
                    (Zn(r) && r.isAttached() && r.isSimpleText() && !r.isUnmergeable() && ct(r),
                      void 0 !== r && qr(r, i) && Gr(e, r, s),
                      n.add(t));
                  }
                  if (((l = e._dirtyLeaves), (c = l.size), c > 0)) {
                    zr++;
                    continue;
                  }
                }
                ((e._dirtyLeaves = new Set()),
                  (e._dirtyElements = new Map()),
                  a.delete('root') && a.set('root', !0));
                for (const t of a) {
                  const n = t[0],
                    l = t[1];
                  if ((r.set(n, l), !l)) continue;
                  const c = o.get(n);
                  void 0 !== c && qr(c, i) && Gr(e, c, s);
                }
                ((l = e._dirtyLeaves), (c = l.size), (a = e._dirtyElements), (u = a.size), zr++);
              }
              ((e._dirtyLeaves = n), (e._dirtyElements = r));
            })(a, e),
        no(e),
        (function (t, e, n, r) {
          const o = t._nodeMap,
            i = e._nodeMap,
            s = [];
          for (const [t] of r) {
            const e = i.get(t);
            void 0 !== e &&
              (e.isAttached() ||
                (co(e) && K(e, t, o, i, s, r), o.has(t) || r.delete(t), s.push(t)));
          }
          for (const t of s) i.delete(t);
          for (const t of n) {
            const e = i.get(t);
            void 0 === e || e.isAttached() || (o.has(t) || n.delete(t), i.delete(t));
          }
        })(c, a, e._dirtyLeaves, e._dirtyElements)));
    o !== e._compositionKey && (a._flushSync = !0);
    const i = a._selection;
    if (ar(i)) {
      const e = a._nodeMap,
        n = i.anchor.key,
        r = i.focus.key;
      (void 0 !== e.get(n) && void 0 !== e.get(r)) || t(19);
    } else fr(i) && 0 === i._nodes.size && (a._selection = null);
  } catch (t) {
    return (
      t instanceof Error && e._onError(t),
      (e._pendingEditorState = c),
      (e._dirtyType = 2),
      e._cloneNotNeeded.clear(),
      (e._dirtyLeaves = new Set()),
      e._dirtyElements.clear(),
      void to(e)
    );
  } finally {
    ((Fr = f), (Kr = d), (Rr = h), (e._updating = g), (zr = 0));
  }
  const p =
    0 !== e._dirtyType ||
    e._deferred.length > 0 ||
    (function (t, e) {
      const n = e.getEditorState()._selection,
        r = t._selection;
      if (null !== r) {
        if (r.dirty || !r.is(n)) return !0;
      } else if (null !== n) return !0;
      return !1;
    })(a, e);
  p
    ? a._flushSync
      ? ((a._flushSync = !1), to(e))
      : u &&
        Po(() => {
          to(e);
        })
    : ((a._flushSync = !1), u && (o.clear(), (e._deferred = []), (e._pendingEditorState = null)));
}
function oo(t, e, n) {
  Rr === t && void 0 === n ? e() : ro(t, e, n);
}
class io {
  element;
  before;
  after;
  constructor(t, e, n) {
    ((this.element = t), (this.before = e || null), (this.after = n || null));
  }
  withBefore(t) {
    return new io(this.element, t, this.after);
  }
  withAfter(t) {
    return new io(this.element, this.before, t);
  }
  withElement(t) {
    return this.element === t ? this : new io(t, this.before, this.after);
  }
  insertChild(e) {
    const n = this.before || this.getManagedLineBreak();
    return (
      null !== n && n.parentElement !== this.element && t(222),
      this.element.insertBefore(e, n),
      this
    );
  }
  removeChild(e) {
    return (e.parentElement !== this.element && t(223), this.element.removeChild(e), this);
  }
  replaceChild(e, n) {
    return (n.parentElement !== this.element && t(224), this.element.replaceChild(e, n), this);
  }
  getFirstChild() {
    const t = this.after ? this.after.nextSibling : this.element.firstChild;
    return t === this.before || t === this.getManagedLineBreak() ? null : t;
  }
  getManagedLineBreak() {
    return this.element.__lexicalLineBreak || null;
  }
  setManagedLineBreak(t) {
    if (null === t) this.removeManagedLineBreak();
    else {
      const e = 'decorator' === t && (d || c || l);
      this.insertManagedLineBreak(e);
    }
  }
  removeManagedLineBreak() {
    const t = this.getManagedLineBreak();
    if (t) {
      const e = this.element,
        n = 'IMG' === t.nodeName ? t.nextSibling : null;
      (n && e.removeChild(n), e.removeChild(t), (e.__lexicalLineBreak = void 0));
    }
  }
  insertManagedLineBreak(t) {
    const e = this.getManagedLineBreak();
    if (e) {
      if (t === ('IMG' === e.nodeName)) return;
      this.removeManagedLineBreak();
    }
    const n = this.element,
      r = this.before,
      o = document.createElement('br');
    if ((n.insertBefore(o, r), t)) {
      const t = document.createElement('img');
      (t.setAttribute('data-lexical-linebreak', 'true'),
        (t.style.cssText =
          'display: inline !important; border: 0px !important; margin: 0px !important;'),
        (t.alt = ''),
        n.insertBefore(t, o),
        (n.__lexicalLineBreak = t));
    } else n.__lexicalLineBreak = o;
  }
  getFirstChildOffset() {
    let t = 0;
    for (let e = this.after; null !== e; e = e.previousSibling) t++;
    return t;
  }
  resolveChildIndex(t, e, n, r) {
    if (n === this.element) {
      const e = this.getFirstChildOffset();
      return [t, Math.min(e + t.getChildrenSize(), Math.max(e, r))];
    }
    const o = so(e, n);
    o.push(r);
    const i = so(e, this.element);
    let s = t.getIndexWithinParent();
    for (let t = 0; t < i.length; t++) {
      const e = o[t],
        n = i[t];
      if (void 0 === e || e < n) break;
      if (e > n) {
        s += 1;
        break;
      }
    }
    return [t.getParentOrThrow(), s];
  }
}
function so(e, n) {
  const r = [];
  let o = n;
  for (; o !== e && null !== o; o = o.parentNode) {
    let t = 0;
    for (let e = o.previousSibling; null !== e; e = e.previousSibling) t++;
    r.push(t);
  }
  return (o !== e && t(225), r.reverse());
}
class lo extends En {
  __first;
  __last;
  __size;
  __format;
  __style;
  __indent;
  __dir;
  __textFormat;
  __textStyle;
  constructor(t) {
    (super(t),
      (this.__first = null),
      (this.__last = null),
      (this.__size = 0),
      (this.__format = 0),
      (this.__style = ''),
      (this.__indent = 0),
      (this.__dir = null),
      (this.__textFormat = 0),
      (this.__textStyle = ''));
  }
  afterCloneFrom(t) {
    (super.afterCloneFrom(t),
      this.__key === t.__key &&
        ((this.__first = t.__first), (this.__last = t.__last), (this.__size = t.__size)),
      (this.__indent = t.__indent),
      (this.__format = t.__format),
      (this.__style = t.__style),
      (this.__dir = t.__dir),
      (this.__textFormat = t.__textFormat),
      (this.__textStyle = t.__textStyle));
  }
  getFormat() {
    return this.getLatest().__format;
  }
  getFormatType() {
    const t = this.getFormat();
    return I[t] || '';
  }
  getStyle() {
    return this.getLatest().__style;
  }
  getIndent() {
    return this.getLatest().__indent;
  }
  getChildren() {
    const t = [];
    let e = this.getFirstChild();
    for (; null !== e; ) (t.push(e), (e = e.getNextSibling()));
    return t;
  }
  getChildrenKeys() {
    const t = [];
    let e = this.getFirstChild();
    for (; null !== e; ) (t.push(e.__key), (e = e.getNextSibling()));
    return t;
  }
  getChildrenSize() {
    return this.getLatest().__size;
  }
  isEmpty() {
    return 0 === this.getChildrenSize();
  }
  isDirty() {
    const t = jr()._dirtyElements;
    return null !== t && t.has(this.__key);
  }
  isLastChild() {
    const t = this.getLatest(),
      e = this.getParentOrThrow().getLastChild();
    return null !== e && e.is(t);
  }
  getAllTextNodes() {
    const t = [];
    let e = this.getFirstChild();
    for (; null !== e; ) {
      if ((Zn(e) && t.push(e), co(e))) {
        const n = e.getAllTextNodes();
        t.push(...n);
      }
      e = e.getNextSibling();
    }
    return t;
  }
  getFirstDescendant() {
    let t = this.getFirstChild();
    for (; co(t); ) {
      const e = t.getFirstChild();
      if (null === e) break;
      t = e;
    }
    return t;
  }
  getLastDescendant() {
    let t = this.getLastChild();
    for (; co(t); ) {
      const e = t.getLastChild();
      if (null === e) break;
      t = e;
    }
    return t;
  }
  getDescendantByIndex(t) {
    const e = this.getChildren(),
      n = e.length;
    if (t >= n) {
      const t = e[n - 1];
      return (co(t) && t.getLastDescendant()) || t || null;
    }
    const r = e[t];
    return (co(r) && r.getFirstDescendant()) || r || null;
  }
  getFirstChild() {
    const t = this.getLatest().__first;
    return null === t ? null : Xo(t);
  }
  getFirstChildOrThrow() {
    const e = this.getFirstChild();
    return (null === e && t(45, this.__key), e);
  }
  getLastChild() {
    const t = this.getLatest().__last;
    return null === t ? null : Xo(t);
  }
  getLastChildOrThrow() {
    const e = this.getLastChild();
    return (null === e && t(96, this.__key), e);
  }
  getChildAtIndex(t) {
    const e = this.getChildrenSize();
    let n, r;
    if (t < e / 2) {
      for (n = this.getFirstChild(), r = 0; null !== n && r <= t; ) {
        if (r === t) return n;
        ((n = n.getNextSibling()), r++);
      }
      return null;
    }
    for (n = this.getLastChild(), r = e - 1; null !== n && r >= t; ) {
      if (r === t) return n;
      ((n = n.getPreviousSibling()), r--);
    }
    return null;
  }
  getTextContent() {
    let t = '';
    const e = this.getChildren(),
      n = e.length;
    for (let r = 0; r < n; r++) {
      const o = e[r];
      ((t += o.getTextContent()), co(o) && r !== n - 1 && !o.isInline() && (t += k));
    }
    return t;
  }
  getTextContentSize() {
    let t = 0;
    const e = this.getChildren(),
      n = e.length;
    for (let r = 0; r < n; r++) {
      const o = e[r];
      ((t += o.getTextContentSize()), co(o) && r !== n - 1 && !o.isInline() && (t += 2));
    }
    return t;
  }
  getDirection() {
    return this.getLatest().__dir;
  }
  getTextFormat() {
    return this.getLatest().__textFormat;
  }
  hasFormat(t) {
    if ('' !== t) {
      const e = P[t];
      return 0 !== (this.getFormat() & e);
    }
    return !1;
  }
  hasTextFormat(t) {
    const e = w[t];
    return 0 !== (this.getTextFormat() & e);
  }
  getFormatFlags(t, e) {
    return Yo(this.getLatest().__textFormat, t, e);
  }
  getTextStyle() {
    return this.getLatest().__textStyle;
  }
  select(t, e) {
    Ur();
    const n = kr();
    let r = t,
      o = e;
    const i = this.getChildrenSize();
    if (!this.canBeEmpty())
      if (0 === t && 0 === e) {
        const t = this.getFirstChild();
        if (Zn(t) || co(t)) return t.select(0, 0);
      } else if (!((void 0 !== t && t !== i) || (void 0 !== e && e !== i))) {
        const t = this.getLastChild();
        if (Zn(t) || co(t)) return t.select();
      }
    (void 0 === r && (r = i), void 0 === o && (o = i));
    const s = this.__key;
    return ar(n)
      ? (n.anchor.set(s, r, 'element'), n.focus.set(s, o, 'element'), (n.dirty = !0), n)
      : Sr(s, r, s, o, 'element', 'element');
  }
  selectStart() {
    const t = this.getFirstDescendant();
    return t ? t.selectStart() : this.select();
  }
  selectEnd() {
    const t = this.getLastDescendant();
    return t ? t.selectEnd() : this.select();
  }
  clear() {
    const t = this.getWritable();
    return (this.getChildren().forEach((t) => t.remove()), t);
  }
  append(...t) {
    return this.splice(this.getChildrenSize(), 0, t);
  }
  setDirection(t) {
    const e = this.getWritable();
    return ((e.__dir = t), e);
  }
  setFormat(t) {
    return ((this.getWritable().__format = '' !== t ? P[t] : 0), this);
  }
  setStyle(t) {
    return ((this.getWritable().__style = t || ''), this);
  }
  setTextFormat(t) {
    const e = this.getWritable();
    return ((e.__textFormat = t), e);
  }
  setTextStyle(t) {
    const e = this.getWritable();
    return ((e.__textStyle = t), e);
  }
  setIndent(t) {
    return ((this.getWritable().__indent = t), this);
  }
  splice(e, n, r) {
    kn(this) && t(324, this.__key, this.__type);
    const o = this.getChildrenSize(),
      i = this.getWritable();
    e + n <= o || t(226, String(e), String(n), String(o));
    const s = i.__key,
      l = [],
      c = [],
      a = this.getChildAtIndex(e + n);
    let u = null,
      f = o - n + r.length;
    if (0 !== e)
      if (e === o) u = this.getLastChild();
      else {
        const t = this.getChildAtIndex(e);
        null !== t && (u = t.getPreviousSibling());
      }
    if (n > 0) {
      let e = null === u ? this.getFirstChild() : u.getNextSibling();
      for (let r = 0; r < n; r++) {
        null === e && t(100);
        const n = e.getNextSibling(),
          r = e.__key;
        (Ho(e.getWritable()), c.push(r), (e = n));
      }
    }
    let d = u;
    for (const e of r) {
      null !== d && e.is(d) && (u = d = d.getPreviousSibling());
      const n = e.getWritable();
      (n.__parent === s && f--, Ho(n));
      const r = e.__key;
      if (null === d) ((i.__first = r), (n.__prev = null));
      else {
        const t = d.getWritable();
        ((t.__next = r), (n.__prev = t.__key));
      }
      (e.__key === s && t(76), (n.__parent = s), l.push(r), (d = e));
    }
    if (e + n === o) {
      if (null !== d) {
        ((d.getWritable().__next = null), (i.__last = d.__key));
      }
    } else if (null !== a) {
      const t = a.getWritable();
      if (null !== d) {
        const e = d.getWritable();
        ((t.__prev = d.__key), (e.__next = a.__key));
      } else t.__prev = null;
    }
    if (((i.__size = f), c.length)) {
      const t = kr();
      if (ar(t)) {
        const e = new Set(c),
          n = new Set(l),
          { anchor: r, focus: o } = t;
        (ao(r, e, n) && Mr(r, r.getNode(), this, u, a),
          ao(o, e, n) && Mr(o, o.getNode(), this, u, a),
          0 !== f || this.canBeEmpty() || Ri(this) || this.remove());
      }
    }
    return i;
  }
  getDOMSlot(t) {
    return new io(t);
  }
  exportDOM(t) {
    const { element: e } = super.exportDOM(t);
    if (ji(e)) {
      const t = this.getIndent();
      t > 0 && (e.style.paddingInlineStart = 40 * t + 'px');
      const n = this.getDirection();
      n && (e.dir = n);
    }
    return { element: e };
  }
  exportJSON() {
    const t = {
        children: [],
        direction: this.getDirection(),
        format: this.getFormatType(),
        indent: this.getIndent(),
        ...super.exportJSON(),
      },
      e = this.getTextFormat(),
      n = this.getTextStyle();
    return (
      (0 === e && '' === n) ||
        Ri(this) ||
        this.getChildren().some(Zn) ||
        (0 !== e && (t.textFormat = e), '' !== n && (t.textStyle = n)),
      t
    );
  }
  updateFromJSON(t) {
    return super
      .updateFromJSON(t)
      .setFormat(t.format)
      .setIndent(t.indent)
      .setDirection(t.direction)
      .setTextFormat(t.textFormat || 0)
      .setTextStyle(t.textStyle || '');
  }
  insertNewAfter(t, e) {
    return null;
  }
  canIndent() {
    return !0;
  }
  collapseAtStart(t) {
    return !1;
  }
  excludeFromCopy(t) {
    return !1;
  }
  canReplaceWith(t) {
    return !0;
  }
  canInsertAfter(t) {
    return !0;
  }
  canBeEmpty() {
    return !0;
  }
  canInsertTextBefore() {
    return !0;
  }
  canInsertTextAfter() {
    return !0;
  }
  isInline() {
    return !1;
  }
  isShadowRoot() {
    return !1;
  }
  canMergeWith(t) {
    return !1;
  }
  extractWithChild(t, e, n) {
    return !1;
  }
  canMergeWhenEmpty() {
    return !1;
  }
  reconcileObservedMutation(t, e) {
    const n = this.getDOMSlot(t);
    let r = n.getFirstChild();
    for (let t = this.getFirstChild(); t; t = t.getNextSibling()) {
      const o = e.getElementByKey(t.getKey());
      null !== o &&
        (null == r ? (n.insertChild(o), (r = o)) : r !== o && n.replaceChild(o, r),
        (r = r.nextSibling));
    }
  }
}
function co(t) {
  return t instanceof lo;
}
function ao(t, e, n) {
  let r = t.getNode();
  for (; r; ) {
    const t = r.__key;
    if (e.has(t) && !n.has(t)) return !0;
    r = r.getParent();
  }
  return !1;
}
class uo extends En {
  decorate(t, e) {
    return null;
  }
  isIsolated() {
    return !1;
  }
  isInline() {
    return !0;
  }
  isKeyboardSelectable() {
    return !0;
  }
}
function fo(t) {
  return t instanceof uo;
}
class ho extends lo {
  __cachedText;
  static getType() {
    return 'root';
  }
  static clone() {
    return new ho();
  }
  constructor() {
    (super('root'), (this.__cachedText = null));
  }
  getTopLevelElementOrThrow() {
    t(51);
  }
  getTextContent() {
    const t = this.__cachedText;
    return (!$r() && 0 !== jr()._dirtyType) || null === t ? super.getTextContent() : t;
  }
  remove() {
    t(52);
  }
  replace(e) {
    t(53);
  }
  insertBefore(e) {
    t(54);
  }
  insertAfter(e) {
    t(55);
  }
  updateDOM(t, e) {
    return !1;
  }
  splice(e, n, r) {
    for (const e of r) co(e) || fo(e) || t(282);
    return super.splice(e, n, r);
  }
  static importJSON(t) {
    return ri().updateFromJSON(t);
  }
  collapseAtStart() {
    return !0;
  }
}
function go(t) {
  return t instanceof ho;
}
function _o(t) {
  return new mo(new Map(t._nodeMap));
}
function po() {
  return new mo(new Map([['root', new ho()]]));
}
function yo(e) {
  const n = e.exportJSON(),
    r = e.constructor;
  if ((n.type !== r.getType() && t(130, r.name), co(e))) {
    const o = n.children;
    Array.isArray(o) || t(59, r.name);
    const i = e.getChildren();
    for (let t = 0; t < i.length; t++) {
      const e = yo(i[t]);
      o.push(e);
    }
  }
  return n;
}
class mo {
  _nodeMap;
  _selection;
  _flushSync;
  _readOnly;
  constructor(t, e) {
    ((this._nodeMap = t),
      (this._selection = e || null),
      (this._flushSync = !1),
      (this._readOnly = !1));
  }
  isEmpty() {
    return 1 === this._nodeMap.size && null === this._selection;
  }
  read(t, e) {
    return Zr((e && e.editor) || null, this, t);
  }
  clone(t) {
    const e = new mo(this._nodeMap, void 0 === t ? this._selection : t);
    return ((e._readOnly = !0), e);
  }
  toJSON() {
    return Zr(null, this, () => ({ root: yo(ri()) }));
  }
}
class xo extends lo {
  static getType() {
    return 'artificial';
  }
  createDOM(t) {
    return document.createElement('div');
  }
}
class Co extends lo {
  static getType() {
    return 'paragraph';
  }
  static clone(t) {
    return new Co(t.__key);
  }
  createDOM(t) {
    const e = document.createElement('p'),
      n = Si(t.theme, 'paragraph');
    if (void 0 !== n) {
      e.classList.add(...n);
    }
    return e;
  }
  updateDOM(t, e, n) {
    return !1;
  }
  static importDOM() {
    return { p: (t) => ({ conversion: So, priority: 0 }) };
  }
  exportDOM(t) {
    const { element: e } = super.exportDOM(t);
    if (ji(e)) {
      this.isEmpty() && e.append(document.createElement('br'));
      const t = this.getFormatType();
      t && (e.style.textAlign = t);
    }
    return { element: e };
  }
  static importJSON(t) {
    return No().updateFromJSON(t);
  }
  exportJSON() {
    const t = super.exportJSON();
    if (void 0 === t.textFormat || void 0 === t.textStyle) {
      const e = this.getChildren().find(Zn);
      e
        ? ((t.textFormat = e.getFormat()), (t.textStyle = e.getStyle()))
        : ((t.textFormat = this.getTextFormat()), (t.textStyle = this.getTextStyle()));
    }
    return t;
  }
  insertNewAfter(t, e) {
    const n = No();
    (n.setTextFormat(t.format), n.setTextStyle(t.style));
    const r = this.getDirection();
    return (
      n.setDirection(r),
      n.setFormat(this.getFormatType()),
      n.setStyle(this.getStyle()),
      this.insertAfter(n, e),
      n
    );
  }
  collapseAtStart() {
    const t = this.getChildren();
    if (0 === t.length || (Zn(t[0]) && '' === t[0].getTextContent().trim())) {
      if (null !== this.getNextSibling()) return (this.selectNext(), this.remove(), !0);
      if (null !== this.getPreviousSibling()) return (this.selectPrevious(), this.remove(), !0);
    }
    return !1;
  }
}
function So(t) {
  const e = No();
  return (t.style && (e.setFormat(t.style.textAlign), rs(t, e)), { node: e });
}
function No() {
  return Bi(new Co());
}
function To(t) {
  return t instanceof Co;
}
const vo = 0;
function ko(t, e, n, r) {
  const o = t._keyToDOMMap;
  (o.clear(),
    (t._editorState = po()),
    (t._pendingEditorState = r),
    (t._compositionKey = null),
    (t._dirtyType = 0),
    t._cloneNotNeeded.clear(),
    (t._dirtyLeaves = new Set()),
    t._dirtyElements.clear(),
    (t._normalizedNodes = new Set()),
    (t._updateTags = new Set()),
    (t._updates = []),
    (t._blockCursorElement = null));
  const i = t._observer;
  (null !== i && (i.disconnect(), (t._observer = null)),
    null !== e && (e.textContent = ''),
    null !== n && ((n.textContent = ''), o.set('root', n)));
}
function Eo(t) {
  const e = new Set(),
    n = new Set();
  let r = t;
  for (; r; ) {
    const { ownNodeConfig: t } = ss(r),
      o = r.transform;
    if (!n.has(o)) {
      n.add(o);
      const t = r.transform();
      t && e.add(t);
    }
    if (t) {
      const n = t.$transform;
      (n && e.add(n), (r = t.extends));
    } else {
      const t = Object.getPrototypeOf(r);
      r = t.prototype instanceof En && t !== En ? t : void 0;
    }
  }
  return e;
}
class Oo {
  static version;
  _headless;
  _parentEditor;
  _rootElement;
  _editorState;
  _pendingEditorState;
  _compositionKey;
  _deferred;
  _keyToDOMMap;
  _updates;
  _updating;
  _listeners;
  _commands;
  _nodes;
  _decorators;
  _pendingDecorators;
  _config;
  _dirtyType;
  _cloneNotNeeded;
  _dirtyLeaves;
  _dirtyElements;
  _normalizedNodes;
  _updateTags;
  _observer;
  _key;
  _onError;
  _htmlConversions;
  _window;
  _editable;
  _blockCursorElement;
  _createEditorArgs;
  constructor(t, e, n, r, o, i, s, l) {
    ((this._createEditorArgs = l),
      (this._parentEditor = e),
      (this._rootElement = null),
      (this._editorState = t),
      (this._pendingEditorState = null),
      (this._compositionKey = null),
      (this._deferred = []),
      (this._keyToDOMMap = new Map()),
      (this._updates = []),
      (this._updating = !1),
      (this._listeners = {
        decorator: new Set(),
        editable: new Set(),
        mutation: new Map(),
        root: new Set(),
        textcontent: new Set(),
        update: new Set(),
      }),
      (this._commands = new Map()),
      (this._config = r),
      (this._nodes = n),
      (this._decorators = {}),
      (this._pendingDecorators = null),
      (this._dirtyType = 0),
      (this._cloneNotNeeded = new Set()),
      (this._dirtyLeaves = new Set()),
      (this._dirtyElements = new Map()),
      (this._normalizedNodes = new Set()),
      (this._updateTags = new Set()),
      (this._observer = null),
      (this._key = ai()),
      (this._onError = o),
      (this._htmlConversions = i),
      (this._editable = s),
      (this._headless = null !== e && e._headless),
      (this._window = null),
      (this._blockCursorElement = null));
  }
  isComposing() {
    return null != this._compositionKey;
  }
  registerUpdateListener(t) {
    const e = this._listeners.update;
    return (
      e.add(t),
      () => {
        e.delete(t);
      }
    );
  }
  registerEditableListener(t) {
    const e = this._listeners.editable;
    return (
      e.add(t),
      () => {
        e.delete(t);
      }
    );
  }
  registerDecoratorListener(t) {
    const e = this._listeners.decorator;
    return (
      e.add(t),
      () => {
        e.delete(t);
      }
    );
  }
  registerTextContentListener(t) {
    const e = this._listeners.textcontent;
    return (
      e.add(t),
      () => {
        e.delete(t);
      }
    );
  }
  registerRootListener(t) {
    const e = this._listeners.root;
    return (
      t(this._rootElement, null),
      e.add(t),
      () => {
        (t(null, this._rootElement), e.delete(t));
      }
    );
  }
  registerCommand(e, n, r) {
    void 0 === r && t(35);
    const o = this._commands;
    o.has(e) || o.set(e, [new Set(), new Set(), new Set(), new Set(), new Set()]);
    const i = o.get(e);
    void 0 === i && t(36, String(e));
    const s = i[r];
    return (
      s.add(n),
      () => {
        (s.delete(n), i.every((t) => 0 === t.size) && o.delete(e));
      }
    );
  }
  registerMutationListener(t, e, n) {
    const r = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t)).klass,
      o = this._listeners.mutation;
    let i = o.get(e);
    (void 0 === i && ((i = new Set()), o.set(e, i)), i.add(r));
    const s = n && n.skipInitialization;
    return (
      (void 0 !== s && s) || this.initializeMutationListener(e, r),
      () => {
        (i.delete(r), 0 === i.size && o.delete(e));
      }
    );
  }
  getRegisteredNode(e) {
    const n = this._nodes.get(e.getType());
    return (void 0 === n && t(37, e.name), n);
  }
  resolveRegisteredNodeAfterReplacements(t) {
    for (; t.replaceWithKlass; ) t = this.getRegisteredNode(t.replaceWithKlass);
    return t;
  }
  initializeMutationListener(t, e) {
    const n = this._editorState,
      r = es(n).get(e.getType());
    if (!r) return;
    const o = new Map();
    for (const t of r.keys()) o.set(t, 'created');
    o.size > 0 &&
      t(o, {
        dirtyLeaves: new Set(),
        prevEditorState: n,
        updateTags: new Set(['registerMutationListener']),
      });
  }
  registerNodeTransformToKlass(t, e) {
    const n = this.getRegisteredNode(t);
    return (n.transforms.add(e), n);
  }
  registerNodeTransform(t, e) {
    const n = this.registerNodeTransformToKlass(t, e),
      r = [n],
      o = n.replaceWithKlass;
    if (null != o) {
      const t = this.registerNodeTransformToKlass(o, e);
      r.push(t);
    }
    return (
      (function (t, e) {
        const n = es(t.getEditorState()),
          r = [];
        for (const t of e) {
          const e = n.get(t);
          e && r.push(e);
        }
        if (0 === r.length) return;
        t.update(
          () => {
            for (const t of r)
              for (const e of t.keys()) {
                const t = Xo(e);
                t && t.markDirty();
              }
          },
          null === t._pendingEditorState ? { tag: On } : void 0,
        );
      })(
        this,
        r.map((t) => t.klass.getType()),
      ),
      () => {
        r.forEach((t) => t.transforms.delete(e));
      }
    );
  }
  hasNode(t) {
    return this._nodes.has(t.getType());
  }
  hasNodes(t) {
    return t.every(this.hasNode.bind(this));
  }
  dispatchCommand(t, e) {
    return Ei(this, t, e);
  }
  getDecorators() {
    return this._decorators;
  }
  getRootElement() {
    return this._rootElement;
  }
  getKey() {
    return this._key;
  }
  setRootElement(t) {
    const e = this._rootElement;
    if (t !== e) {
      const n = Si(this._config.theme, 'root'),
        r = this._pendingEditorState || this._editorState;
      if (
        ((this._rootElement = t),
        ko(this, e, t, r),
        null !== e && (this._config.disableEvents || Nn(e), null != n && e.classList.remove(...n)),
        null !== t)
      ) {
        const e = Ii(t),
          r = t.style;
        ((r.userSelect = 'text'),
          (r.whiteSpace = 'pre-wrap'),
          (r.wordBreak = 'break-word'),
          t.setAttribute('data-lexical-editor', 'true'),
          (this._window = e),
          (this._dirtyType = 2),
          V(this),
          this._updateTags.add(On),
          to(this),
          this._config.disableEvents ||
            (function (t, e) {
              const n = t.ownerDocument;
              He.set(t, n);
              const r = Ve.get(n) ?? 0;
              (r < 1 && n.addEventListener('selectionchange', mn),
                Ve.set(n, r + 1),
                (t.__lexicalEditor = e));
              const o = pn(t);
              for (let n = 0; n < $e.length; n++) {
                const [r, i] = $e[n],
                  s =
                    'function' == typeof i
                      ? (t) => {
                          Cn(t) || (xn(t), (e.isEditable() || 'click' === r) && i(t, e));
                        }
                      : (t) => {
                          if (Cn(t)) return;
                          xn(t);
                          const n = e.isEditable();
                          switch (r) {
                            case 'cut':
                              return n && Ei(e, De, t);
                            case 'copy':
                              return Ei(e, we, t);
                            case 'paste':
                              return n && Ei(e, re, t);
                            case 'dragstart':
                              return n && Ei(e, be, t);
                            case 'dragover':
                              return n && Ei(e, Me, t);
                            case 'dragend':
                              return n && Ei(e, Ae, t);
                            case 'focus':
                              return n && Ei(e, Ke, t);
                            case 'blur':
                              return n && Ei(e, Be, t);
                            case 'drop':
                              return n && Ei(e, Ee, t);
                          }
                        };
                (t.addEventListener(r, s),
                  o.push(() => {
                    t.removeEventListener(r, s);
                  }));
              }
            })(t, this),
          null != n && t.classList.add(...n));
      } else ((this._window = null), this._updateTags.add(On), to(this));
      eo('root', this, !1, t, e);
    }
  }
  getElementByKey(t) {
    return this._keyToDOMMap.get(t) || null;
  }
  getEditorState() {
    return this._editorState;
  }
  setEditorState(e, n) {
    e.isEmpty() && t(38);
    let r = e;
    (r._readOnly && ((r = _o(e)), (r._selection = e._selection ? e._selection.clone() : null)),
      H(this));
    const o = this._pendingEditorState,
      i = this._updateTags,
      s = void 0 !== n ? n.tag : null;
    (null === o || o.isEmpty() || (null != s && i.add(s), to(this)),
      (this._pendingEditorState = r),
      (this._dirtyType = 2),
      this._dirtyElements.set('root', !1),
      (this._compositionKey = null),
      null != s && i.add(s),
      this._updating || to(this));
  }
  parseEditorState(t, e) {
    return (function (t, e, n) {
      const r = po(),
        o = Fr,
        i = Kr,
        s = Rr,
        l = e._dirtyElements,
        c = e._dirtyLeaves,
        a = e._cloneNotNeeded,
        u = e._dirtyType;
      ((e._dirtyElements = new Map()),
        (e._dirtyLeaves = new Set()),
        (e._cloneNotNeeded = new Set()),
        (e._dirtyType = 0),
        (Fr = r),
        (Kr = !1),
        (Rr = e),
        Mo(null));
      try {
        const o = e._nodes;
        (Qr(t.root, o), n && n(r), (r._readOnly = !0));
      } catch (t) {
        t instanceof Error && e._onError(t);
      } finally {
        ((e._dirtyElements = l),
          (e._dirtyLeaves = c),
          (e._cloneNotNeeded = a),
          (e._dirtyType = u),
          (Fr = o),
          (Kr = i),
          (Rr = s));
      }
      return r;
    })('string' == typeof t ? JSON.parse(t) : t, this, e);
  }
  read(t) {
    return (to(this), this.getEditorState().read(t, { editor: this }));
  }
  update(t, e) {
    !(function (t, e, n) {
      t._updating ? t._updates.push([e, n]) : ro(t, e, n);
    })(this, t, e);
  }
  focus(t, e = {}) {
    const n = this._rootElement;
    null !== n &&
      (n.setAttribute('autocapitalize', 'off'),
      oo(this, () => {
        const r = kr(),
          o = ri();
        (null !== r
          ? r.dirty || ii(r.clone())
          : 0 !== o.getChildrenSize() &&
            ('rootStart' === e.defaultSelection ? o.selectStart() : o.selectEnd()),
          wi('focus'),
          Di(() => {
            (n.removeAttribute('autocapitalize'), t && t());
          }));
      }),
      null === this._pendingEditorState && n.removeAttribute('autocapitalize'));
  }
  blur() {
    const t = this._rootElement;
    null !== t && t.blur();
    const e = Ji(this._window);
    null !== e && e.removeAllRanges();
  }
  isEditable() {
    return this._editable;
  }
  setEditable(t) {
    this._editable !== t && ((this._editable = t), eo('editable', this, !0, t));
  }
  toJSON() {
    return { editorState: this._editorState.toJSON() };
  }
}
Oo.version = '0.39.0+prod.cjs';
let bo = null;
function Mo(t) {
  bo = t;
}
let Ao = 1;
function wo(e, n) {
  const r = Do(e, n);
  return (void 0 === r && t(30, n), r);
}
function Do(t, e) {
  return t._nodes.get(e);
}
const Po =
  'function' == typeof queueMicrotask
    ? queueMicrotask
    : (t) => {
        Promise.resolve().then(t);
      };
function Io(t) {
  return fo(ti(t));
}
function Lo(t) {
  const e = document.activeElement;
  if (!ji(e)) return !1;
  const n = e.nodeName;
  return (
    fo(ti(t)) &&
    ('INPUT' === n || 'TEXTAREA' === n || ('true' === e.contentEditable && null == Bo(e)))
  );
}
function Fo(t, e, n) {
  const r = t.getRootElement();
  try {
    return null !== r && r.contains(e) && r.contains(n) && null !== e && !Lo(e) && Ko(e) === t;
  } catch (t) {
    return !1;
  }
}
function Ro(t) {
  return t instanceof Oo;
}
function Ko(t) {
  let e = t;
  for (; null != e; ) {
    const t = Bo(e);
    if (Ro(t)) return t;
    e = Mi(e);
  }
  return null;
}
function Bo(t) {
  return t ? t.__lexicalEditor : null;
}
function zo(t) {
  return rr(t) || t.isToken();
}
function Wo(t) {
  return zo(t) || t.isSegmented();
}
function $o(t) {
  return Hi(t) && 3 === t.nodeType;
}
function Uo(t) {
  return Hi(t) && 9 === t.nodeType;
}
function Jo(t) {
  let e = t;
  for (; null != e; ) {
    if ($o(e)) return e;
    e = e.firstChild;
  }
  return null;
}
function Yo(t, e, n) {
  const r = w[e];
  if (null !== n && (t & r) === (n & r)) return t;
  let o = t ^ r;
  return (
    'subscript' === e
      ? (o &= ~w.superscript)
      : 'superscript' === e
        ? (o &= ~w.subscript)
        : 'lowercase' === e
          ? ((o &= ~w.uppercase), (o &= ~w.capitalize))
          : 'uppercase' === e
            ? ((o &= ~w.lowercase), (o &= ~w.capitalize))
            : 'capitalize' === e && ((o &= ~w.lowercase), (o &= ~w.uppercase)),
    o
  );
}
function jo(t, e) {
  const n = (function () {
    const t = bo;
    return ((bo = null), t);
  })();
  if (null != (e = e || (n && n.__key))) return void (t.__key = e);
  (Ur(), Jr());
  const r = jr(),
    o = Yr(),
    i = '' + Ao++;
  (o._nodeMap.set(i, t),
    co(t) ? r._dirtyElements.set(i, !0) : r._dirtyLeaves.add(i),
    r._cloneNotNeeded.add(i),
    (r._dirtyType = 1),
    (t.__key = i));
}
function Ho(t) {
  const e = t.getParent();
  if (null !== e) {
    const n = t.getWritable(),
      r = e.getWritable(),
      o = t.getPreviousSibling(),
      i = t.getNextSibling(),
      s = null !== i ? i.__key : null,
      l = null !== o ? o.__key : null,
      c = null !== o ? o.getWritable() : null,
      a = null !== i ? i.getWritable() : null;
    (null === o && (r.__first = s),
      null === i && (r.__last = l),
      null !== c && (c.__next = s),
      null !== a && (a.__prev = l),
      (n.__prev = null),
      (n.__next = null),
      (n.__parent = null),
      r.__size--);
  }
}
function Vo(e) {
  (Jr(), kn(e) && t(323, e.__key, e.__type));
  const n = e.getLatest(),
    r = n.__parent,
    o = Yr(),
    i = jr(),
    s = o._nodeMap,
    l = i._dirtyElements;
  null !== r &&
    (function (t, e, n) {
      let r = t;
      for (; null !== r; ) {
        if (n.has(r)) return;
        const t = e.get(r);
        if (void 0 === t) break;
        (n.set(r, !1), (r = t.__parent));
      }
    })(r, s, l);
  const c = n.__key;
  ((i._dirtyType = 1), co(e) ? l.set(c, !0) : i._dirtyLeaves.add(c));
}
function Go(t) {
  Ur();
  const e = jr(),
    n = e._compositionKey;
  if (t !== n) {
    if (((e._compositionKey = t), null !== n)) {
      const t = Xo(n);
      null !== t && t.getWritable();
    }
    if (null !== t) {
      const e = Xo(t);
      null !== e && e.getWritable();
    }
  }
}
function qo() {
  if ($r()) return null;
  return jr()._compositionKey;
}
function Xo(t, e) {
  const n = (e || Yr())._nodeMap.get(t);
  return void 0 === n ? null : n;
}
function Qo(t, e) {
  const n = Zo(t, jr());
  return void 0 !== n ? Xo(n, e) : null;
}
function Zo(t, e) {
  return t[`__lexicalKey_${e._key}`];
}
function ti(t, e) {
  let n = t;
  for (; null != n; ) {
    const t = Qo(n, e);
    if (null !== t) return t;
    n = Mi(n);
  }
  return null;
}
function ei(t) {
  const e = t._decorators,
    n = Object.assign({}, e);
  return ((t._pendingDecorators = n), n);
}
function ni(t) {
  return t.read(() => ri().getTextContent());
}
function ri() {
  return oi(Yr());
}
function oi(t) {
  return t._nodeMap.get('root');
}
function ii(t) {
  Ur();
  const e = Yr();
  (null !== t && ((t.dirty = !0), t.setCachedNodes(null)), (e._selection = t));
}
function si(t) {
  const e = jr(),
    n = (function (t, e) {
      let n = t;
      for (; null != n; ) {
        const t = Zo(n, e);
        if (void 0 !== t) return t;
        n = Mi(n);
      }
      return null;
    })(t, e);
  if (null === n) {
    return t === e.getRootElement() ? Xo('root') : null;
  }
  return Xo(n);
}
function li(t) {
  return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t);
}
function ci(t) {
  const e = [];
  let n = t;
  for (; null !== n; ) (e.push(n), (n = n._parentEditor));
  return e;
}
function ai() {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substring(0, 5);
}
function ui(t) {
  return $o(t) ? t.nodeValue : null;
}
function fi(t, e, n) {
  const r = Ji(Li(e));
  if (null === r) return;
  const o = r.anchorNode;
  let { anchorOffset: i, focusOffset: s } = r;
  if (null !== o) {
    let e = ui(o);
    const r = ti(o);
    if (null !== e && Zn(r)) {
      if (e === v && n) {
        const t = n.length;
        ((e = n), (i = t), (s = t));
      }
      null !== e && di(r, e, i, s, t);
    }
  }
}
function di(t, e, n, r, o) {
  let i = t;
  if (i.isAttached() && (o || !i.isDirty())) {
    const s = i.isComposing();
    let a = e;
    (s || o) && e[e.length - 1] === v && (a = e.slice(0, -1));
    const u = i.getTextContent();
    if (o || a !== u) {
      if ('' === a) {
        if ((Go(null), l || c || d)) i.remove();
        else {
          const t = jr();
          setTimeout(() => {
            t.update(() => {
              i.isAttached() && i.remove();
            });
          }, 20);
        }
        return;
      }
      const e = i.getParent(),
        o = Er(),
        u = i.getTextContentSize(),
        f = qo(),
        h = i.getKey();
      if (
        i.isToken() ||
        (null !== f && h === f && !s) ||
        (ar(o) &&
          ((null !== e && !e.canInsertTextBefore() && 0 === o.anchor.offset) ||
            (o.anchor.key === t.__key && 0 === o.anchor.offset && !i.canInsertTextBefore() && !s) ||
            (o.focus.key === t.__key && o.focus.offset === u && !i.canInsertTextAfter() && !s)))
      )
        return void i.markDirty();
      const g = kr();
      if (!ar(g) || null === n || null === r) return void hi(i, a, g);
      if ((g.setTextNodeRange(i, n, i, r), i.isSegmented())) {
        const t = Qn(i.getTextContent());
        (i.replace(t), (i = t));
      }
      hi(i, a, g);
    }
  }
}
function hi(t, e, n) {
  if ((t.setTextContent(e), ar(n))) {
    const e = t.getKey();
    for (const r of ['anchor', 'focus']) {
      const o = n[r];
      'text' === o.type && o.key === e && (o.offset = vs(t, o.offset, 'clamp'));
    }
  }
}
function gi(t, e, n) {
  const r = e[n] || !1;
  return 'any' === r || r === t[n];
}
function _i(t, e) {
  return gi(t, e, 'altKey') && gi(t, e, 'ctrlKey') && gi(t, e, 'shiftKey') && gi(t, e, 'metaKey');
}
function pi(t, e, n) {
  return _i(t, n) && t.key.toLowerCase() === e.toLowerCase();
}
const yi = { ctrlKey: !o, metaKey: o },
  mi = { altKey: o, ctrlKey: !o };
function xi(t) {
  return 'Backspace' === t.key;
}
function Ci(t) {
  return pi(t, 'a', yi);
}
function Si(t, e) {
  void 0 === t.__lexicalClassNameCache && (t.__lexicalClassNameCache = {});
  const n = t.__lexicalClassNameCache,
    r = n[e];
  if (void 0 !== r) return r;
  const o = t[e];
  if ('string' == typeof o) {
    const t = h(o);
    return ((n[e] = t), t);
  }
  return o;
}
function Ni(e, n, r, o, i) {
  if (0 === r.size) return;
  const s = o.__type,
    l = o.__key,
    c = n.get(s);
  void 0 === c && t(33, s);
  const a = c.klass;
  let u = e.get(a);
  void 0 === u && ((u = new Map()), e.set(a, u));
  const f = u.get(l),
    d = 'destroyed' === f && 'created' === i;
  (void 0 === f || d) && u.set(l, d ? 'updated' : i);
}
function Ti(t, e, n) {
  const r = t.getParent();
  let o = n,
    i = t;
  return (
    null !== r &&
      (e && 0 === n
        ? ((o = i.getIndexWithinParent()), (i = r))
        : e || n !== i.getChildrenSize() || ((o = i.getIndexWithinParent() + 1), (i = r))),
    i.getChildAtIndex(e ? o - 1 : o)
  );
}
function vi(t, e) {
  const n = t.offset;
  if ('element' === t.type) {
    return Ti(t.getNode(), e, n);
  }
  {
    const r = t.getNode();
    if ((e && 0 === n) || (!e && n === r.getTextContentSize())) {
      const t = e ? r.getPreviousSibling() : r.getNextSibling();
      return null === t ? Ti(r.getParentOrThrow(), e, r.getIndexWithinParent() + (e ? 0 : 1)) : t;
    }
  }
  return null;
}
function ki(t) {
  const e = Li(t).event,
    n = e && e.inputType;
  return 'insertFromPaste' === n || 'insertFromPasteAsQuotation' === n;
}
function Ei(t, e, n) {
  return (function (t, e, n) {
    const r = ci(t);
    for (let o = 4; o >= 0; o--)
      for (let i = 0; i < r.length; i++) {
        const s = r[i],
          l = s._commands.get(e);
        if (void 0 !== l) {
          const e = l[o];
          if (void 0 !== e) {
            const r = Array.from(e),
              o = r.length;
            let i = !1;
            if (
              (oo(s, () => {
                for (let e = 0; e < o; e++) if (r[e](n, t)) return void (i = !0);
              }),
              i)
            )
              return i;
          }
        }
      }
    return !1;
  })(t, e, n);
}
function Oi(t) {
  return !go(t) && !t.isLastChild() && !t.isInline();
}
function bi(e, n) {
  const r = e._keyToDOMMap.get(n);
  return (void 0 === r && t(75, n), r);
}
function Mi(t) {
  const e = t.assignedSlot || t.parentElement;
  return Vi(e) ? e.host : e;
}
function Ai(t) {
  return Uo(t) ? t : ji(t) ? t.ownerDocument : null;
}
function wi(t) {
  Ur();
  jr()._updateTags.add(t);
}
function Di(t) {
  Ur();
  jr()._deferred.push(t);
}
function Pi(t, e) {
  let n = t.getParent();
  for (; null !== n; ) {
    if (n.is(e)) return !0;
    n = n.getParent();
  }
  return !1;
}
function Ii(t) {
  const e = Ai(t);
  return e ? e.defaultView : null;
}
function Li(e) {
  const n = e._window;
  return (null === n && t(78), n);
}
function Fi(t) {
  let e = t.getParentOrThrow();
  for (; null !== e; ) {
    if (Ri(e)) return e;
    e = e.getParentOrThrow();
  }
  return e;
}
function Ri(t) {
  return go(t) || (co(t) && t.isShadowRoot());
}
function Ki(t) {
  const e = t.constructor.clone(t);
  return (jo(e, null), e.afterCloneFrom(t), e);
}
function Bi(e) {
  const n = jr(),
    r = e.getType(),
    o = Do(n, r);
  void 0 === o && t(200, e.constructor.name, r);
  const { replace: i, replaceWithKlass: s } = o;
  if (null !== i) {
    const n = i(e),
      o = n.constructor;
    return (
      null !== s
        ? n instanceof s || t(201, s.name, s.getType(), o.name, o.getType(), e.constructor.name, r)
        : (n instanceof e.constructor && o !== e.constructor) ||
          t(202, o.name, o.getType(), e.constructor.name, r),
      n.__key === e.__key && t(203, e.constructor.name, r, o.name, o.getType()),
      n
    );
  }
  return e;
}
function zi(e, n) {
  !go(e.getParent()) || co(n) || fo(n) || t(99);
}
function Wi(e) {
  const n = Xo(e);
  return (null === n && t(63, e), n);
}
function $i(t) {
  return (fo(t) || (co(t) && !t.canBeEmpty())) && !t.isInline();
}
function Ui(t, e, n) {
  (n.style.removeProperty('caret-color'), (e._blockCursorElement = null));
  const r = t.parentElement;
  null !== r && r.removeChild(t);
}
function Ji(t) {
  return n ? (t || window).getSelection() : null;
}
function Yi(t) {
  const e = Ii(t);
  return e ? e.getSelection() : null;
}
function ji(t) {
  return Hi(t) && 1 === t.nodeType;
}
function Hi(t) {
  return 'object' == typeof t && null !== t && 'nodeType' in t && 'number' == typeof t.nodeType;
}
function Vi(t) {
  return Hi(t) && 11 === t.nodeType;
}
function Gi(t) {
  const e = new RegExp(
    /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/,
    'i',
  );
  return null !== t.nodeName.match(e);
}
function qi(t) {
  const e = new RegExp(
    /^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/,
    'i',
  );
  return null !== t.nodeName.match(e);
}
function Xi(t) {
  if (fo(t) && !t.isInline()) return !0;
  if (!co(t) || Ri(t)) return !1;
  const e = t.getFirstChild(),
    n = null === e || Ln(e) || Zn(e) || e.isInline();
  return !t.isInline() && !1 !== t.canBeEmpty() && n;
}
function Qi() {
  return jr();
}
const Zi = new WeakMap(),
  ts = new Map();
function es(e) {
  if (!e._readOnly && e.isEmpty()) return ts;
  e._readOnly || t(192);
  let n = Zi.get(e);
  return (
    n ||
      ((n = (function (t) {
        const e = new Map();
        for (const [n, r] of t._nodeMap) {
          const t = r.__type;
          let o = e.get(t);
          (o || ((o = new Map()), e.set(t, o)), o.set(n, r));
        }
        return e;
      })(e)),
      Zi.set(e, n)),
    n
  );
}
function ns(t) {
  const e = t.constructor.clone(t);
  return (e.afterCloneFrom(t), e);
}
function rs(t, e) {
  const n = parseInt(t.style.paddingInlineStart, 10) || 0,
    r = Math.round(n / 40);
  e.setIndent(r);
}
function os(t) {
  return !0 === t.__lexicalUnmanaged;
}
function is(t, e) {
  return (
    (function (t, e) {
      return Object.prototype.hasOwnProperty.call(t, e);
    })(t, e) && t[e] !== En[e]
  );
}
function ss(e) {
  const n = R in e.prototype ? e.prototype[R]() : void 0,
    r = (function (e) {
      if (!(e === En || e.prototype instanceof En)) {
        let n = '<unknown>',
          r = '<unknown>';
        try {
          n = e.getType();
        } catch (t) {}
        try {
          Oo.version && (r = JSON.parse(Oo.version));
        } catch (t) {}
        t(290, e.name, n, r);
      }
      return e === uo || e === lo || e === En;
    })(e),
    o = !r && is(e, 'getType') ? e.getType() : void 0;
  let i,
    s = o;
  if (n)
    if (o) i = n[o];
    else for (const [t, e] of Object.entries(n)) ((s = t), (i = e));
  if (
    !r &&
    s &&
    (is(e, 'getType') || (e.getType = () => s),
    is(e, 'clone') || (e.clone = (t) => (Mo(t), new e())),
    is(e, 'importJSON') ||
      (e.importJSON = (i && i.$importJSON) || ((t) => new e().updateFromJSON(t))),
    !is(e, 'importDOM') && i)
  ) {
    const { importDOM: t } = i;
    t && (e.importDOM = () => t);
  }
  return { ownNodeConfig: i, ownNodeType: s };
}
const ls = (t, e) => {
    let n = t;
    for (; null != n && !go(n); ) {
      if (e(n)) return n;
      n = n.getParent();
    }
    return null;
  },
  cs = { next: 'previous', previous: 'next' };
class as {
  origin;
  constructor(t) {
    this.origin = t;
  }
  [Symbol.iterator]() {
    return Is({
      hasNext: ys,
      initial: this.getAdjacentCaret(),
      map: (t) => t,
      step: (t) => t.getAdjacentCaret(),
    });
  }
  getAdjacentCaret() {
    return Ns(this.getNodeAtCaret(), this.direction);
  }
  getSiblingCaret() {
    return Ns(this.origin, this.direction);
  }
  remove() {
    const t = this.getNodeAtCaret();
    return (t && t.remove(), this);
  }
  replaceOrInsert(t, e) {
    const n = this.getNodeAtCaret();
    return (t.is(this.origin) || t.is(n) || (null === n ? this.insert(t) : n.replace(t, e)), this);
  }
  splice(e, n, r = 'next') {
    const o = r === this.direction ? n : Array.from(n).reverse();
    let i = this;
    const s = this.getParentAtCaret(),
      l = new Map();
    for (let t = i.getAdjacentCaret(); null !== t && l.size < e; t = t.getAdjacentCaret()) {
      const e = t.origin.getWritable();
      l.set(e.getKey(), e);
    }
    for (const e of o) {
      if (l.size > 0) {
        const n = i.getNodeAtCaret();
        if (n)
          if ((l.delete(n.getKey()), l.delete(e.getKey()), n.is(e) || i.origin.is(e)));
          else {
            const t = e.getParent();
            (t && t.is(s) && e.remove(), n.replace(e));
          }
        else null === n && t(263, Array.from(l).join(' '));
      } else i.insert(e);
      i = Ns(e, this.direction);
    }
    for (const t of l.values()) t.remove();
    return this;
  }
}
class us extends as {
  type = 'child';
  getLatest() {
    const t = this.origin.getLatest();
    return t === this.origin ? this : Es(t, this.direction);
  }
  getParentCaret(t = 'root') {
    return Ns(hs(this.getParentAtCaret(), t), this.direction);
  }
  getFlipped() {
    const t = ds(this.direction);
    return Ns(this.getNodeAtCaret(), t) || Es(this.origin, t);
  }
  getParentAtCaret() {
    return this.origin;
  }
  getChildCaret() {
    return this;
  }
  isSameNodeCaret(t) {
    return t instanceof us && this.direction === t.direction && this.origin.is(t.origin);
  }
  isSamePointCaret(t) {
    return this.isSameNodeCaret(t);
  }
}
const fs = { root: go, shadowRoot: Ri };
function ds(t) {
  return cs[t];
}
function hs(t, e = 'root') {
  return fs[e](t) ? null : t;
}
class gs extends as {
  type = 'sibling';
  getLatest() {
    const t = this.origin.getLatest();
    return t === this.origin ? this : Ns(t, this.direction);
  }
  getSiblingCaret() {
    return this;
  }
  getParentAtCaret() {
    return this.origin.getParent();
  }
  getChildCaret() {
    return co(this.origin) ? Es(this.origin, this.direction) : null;
  }
  getParentCaret(t = 'root') {
    return Ns(hs(this.getParentAtCaret(), t), this.direction);
  }
  getFlipped() {
    const t = ds(this.direction);
    return Ns(this.getNodeAtCaret(), t) || Es(this.origin.getParentOrThrow(), t);
  }
  isSamePointCaret(t) {
    return t instanceof gs && this.direction === t.direction && this.origin.is(t.origin);
  }
  isSameNodeCaret(t) {
    return (
      (t instanceof gs || t instanceof _s) &&
      this.direction === t.direction &&
      this.origin.is(t.origin)
    );
  }
}
class _s extends as {
  type = 'text';
  offset;
  constructor(t, e) {
    (super(t), (this.offset = e));
  }
  getLatest() {
    const t = this.origin.getLatest();
    return t === this.origin ? this : Ts(t, this.direction, this.offset);
  }
  getParentAtCaret() {
    return this.origin.getParent();
  }
  getChildCaret() {
    return null;
  }
  getParentCaret(t = 'root') {
    return Ns(hs(this.getParentAtCaret(), t), this.direction);
  }
  getFlipped() {
    return Ts(this.origin, ds(this.direction), this.offset);
  }
  isSamePointCaret(t) {
    return (
      t instanceof _s &&
      this.direction === t.direction &&
      this.origin.is(t.origin) &&
      this.offset === t.offset
    );
  }
  isSameNodeCaret(t) {
    return (
      (t instanceof gs || t instanceof _s) &&
      this.direction === t.direction &&
      this.origin.is(t.origin)
    );
  }
  getSiblingCaret() {
    return Ns(this.origin, this.direction);
  }
}
function ps(t) {
  return t instanceof _s;
}
function ys(t) {
  return t instanceof gs;
}
function ms(t) {
  return t instanceof us;
}
const xs = {
    next: class extends _s {
      direction = 'next';
      getNodeAtCaret() {
        return this.origin.getNextSibling();
      }
      insert(t) {
        return (this.origin.insertAfter(t), this);
      }
    },
    previous: class extends _s {
      direction = 'previous';
      getNodeAtCaret() {
        return this.origin.getPreviousSibling();
      }
      insert(t) {
        return (this.origin.insertBefore(t), this);
      }
    },
  },
  Cs = {
    next: class extends gs {
      direction = 'next';
      getNodeAtCaret() {
        return this.origin.getNextSibling();
      }
      insert(t) {
        return (this.origin.insertAfter(t), this);
      }
    },
    previous: class extends gs {
      direction = 'previous';
      getNodeAtCaret() {
        return this.origin.getPreviousSibling();
      }
      insert(t) {
        return (this.origin.insertBefore(t), this);
      }
    },
  },
  Ss = {
    next: class extends us {
      direction = 'next';
      getNodeAtCaret() {
        return this.origin.getFirstChild();
      }
      insert(t) {
        return (this.origin.splice(0, 0, [t]), this);
      }
    },
    previous: class extends us {
      direction = 'previous';
      getNodeAtCaret() {
        return this.origin.getLastChild();
      }
      insert(t) {
        return (this.origin.splice(this.origin.getChildrenSize(), 0, [t]), this);
      }
    },
  };
function Ns(t, e) {
  return t ? new Cs[e](t) : null;
}
function Ts(t, e, n) {
  return t ? new xs[e](t, vs(t, n)) : null;
}
function vs(t, n, r = 'error') {
  const o = t.getTextContentSize();
  let i = 'next' === n ? o : 'previous' === n ? 0 : n;
  return (
    (i < 0 || i > o) &&
      ('clamp' !== r && e(284, String(n), String(o), t.getKey()), (i = i < 0 ? 0 : o)),
    i
  );
}
function ks(t, e) {
  return new As(t, e);
}
function Es(t, e) {
  return co(t) ? new Ss[e](t) : null;
}
function Os(t) {
  return (t && t.getChildCaret()) || t;
}
function bs(t) {
  return t && Os(t.getAdjacentCaret());
}
class Ms {
  type = 'node-caret-range';
  direction;
  anchor;
  focus;
  constructor(t, e, n) {
    ((this.anchor = t), (this.focus = e), (this.direction = n));
  }
  getLatest() {
    const t = this.anchor.getLatest(),
      e = this.focus.getLatest();
    return t === this.anchor && e === this.focus ? this : new Ms(t, e, this.direction);
  }
  isCollapsed() {
    return this.anchor.isSamePointCaret(this.focus);
  }
  getTextSlices() {
    const t = (t) => {
        const e = this[t].getLatest();
        return ps(e)
          ? (function (t, e) {
              const { direction: n, origin: r } = t,
                o = vs(r, 'focus' === e ? ds(n) : n);
              return ks(t, o - t.offset);
            })(e, t)
          : null;
      },
      e = t('anchor'),
      n = t('focus');
    if (e && n) {
      const { caret: t } = e,
        { caret: r } = n;
      if (t.isSameNodeCaret(r)) return [ks(t, r.offset - t.offset), null];
    }
    return [e, n];
  }
  iterNodeCarets(t = 'root') {
    const e = ps(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(),
      n = this.focus.getLatest(),
      r = ps(n),
      o = (e) => (e.isSameNodeCaret(n) ? null : bs(e) || e.getParentCaret(t));
    return Is({
      hasNext: (t) => null !== t && !(r && n.isSameNodeCaret(t)),
      initial: e.isSameNodeCaret(n) ? null : o(e),
      map: (t) => t,
      step: o,
    });
  }
  [Symbol.iterator]() {
    return this.iterNodeCarets('root');
  }
}
class As {
  type = 'slice';
  caret;
  distance;
  constructor(t, e) {
    ((this.caret = t), (this.distance = e));
  }
  getSliceIndices() {
    const {
        distance: t,
        caret: { offset: e },
      } = this,
      n = e + t;
    return n < e ? [n, e] : [e, n];
  }
  getTextContent() {
    const [t, e] = this.getSliceIndices();
    return this.caret.origin.getTextContent().slice(t, e);
  }
  getTextContentSize() {
    return Math.abs(this.distance);
  }
  removeTextSlice() {
    const {
        caret: { origin: t, direction: e },
      } = this,
      [n, r] = this.getSliceIndices(),
      o = t.getTextContent();
    return Ts(t.setTextContent(o.slice(0, n) + o.slice(r)), e, n);
  }
}
function ws(t) {
  return Ps(t, Ns(ri(), t.direction));
}
function Ds(t) {
  return Ps(t, t);
}
function Ps(e, n) {
  return (e.direction !== n.direction && t(265), new Ms(e, n, e.direction));
}
function Is(t) {
  const { initial: e, hasNext: n, step: r, map: o } = t;
  let i = e;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      if (!n(i)) return { done: !0, value: void 0 };
      const t = { done: !1, value: o(i) };
      return ((i = r(i)), t);
    },
  };
}
function Ls(e, n) {
  const r = Bs(e.origin, n.origin);
  switch ((null === r && t(275, e.origin.getKey(), n.origin.getKey()), r.type)) {
    case 'same': {
      const t = 'text' === e.type,
        r = 'text' === n.type;
      return t && r
        ? (function (t, e) {
            return Math.sign(t - e);
          })(e.offset, n.offset)
        : e.type === n.type
          ? 0
          : t
            ? -1
            : r
              ? 1
              : 'child' === e.type
                ? -1
                : 1;
    }
    case 'ancestor':
      return 'child' === e.type ? -1 : 1;
    case 'descendant':
      return 'child' === n.type ? 1 : -1;
    case 'branch':
      return Fs(r);
  }
}
function Fs(t) {
  const { a: e, b: n } = t,
    r = e.__key,
    o = n.__key;
  let i = e,
    s = n;
  for (; i && s; i = i.getNextSibling(), s = s.getNextSibling()) {
    if (i.__key === o) return -1;
    if (s.__key === r) return 1;
  }
  return null === i ? 1 : -1;
}
function Rs(t, e) {
  return e.is(t);
}
function Ks(t) {
  return co(t) ? [t.getLatest(), null] : [t.getParent(), t.getLatest()];
}
function Bs(e, n) {
  if (e.is(n)) return { commonAncestor: e, type: 'same' };
  const r = new Map();
  for (let [t, n] = Ks(e); t; n = t, t = t.getParent()) r.set(t, n);
  for (let [o, i] = Ks(n); o; i = o, o = o.getParent()) {
    const s = r.get(o);
    if (void 0 !== s)
      return null === s
        ? (Rs(e, o) || t(276), { commonAncestor: o, type: 'ancestor' })
        : null === i
          ? (Rs(n, o) || t(277), { commonAncestor: o, type: 'descendant' })
          : (((co(s) || Rs(e, s)) &&
              (co(i) || Rs(n, i)) &&
              o.is(s.getParent()) &&
              o.is(i.getParent())) ||
              t(278),
            { a: s, b: i, commonAncestor: o, type: 'branch' });
  }
  return null;
}
function zs(e, n) {
  const { type: r, key: o, offset: i } = e,
    s = Wi(e.key);
  return 'text' === r
    ? (Zn(s) || t(266, s.getType(), o), Ts(s, n, i))
    : (co(s) || t(267, s.getType(), o), Zs(s, e.offset, n));
}
function Ws(e, n) {
  const { origin: r, direction: o } = n,
    i = 'next' === o;
  ps(n)
    ? e.set(r.getKey(), n.offset, 'text')
    : ys(n)
      ? Zn(r)
        ? e.set(r.getKey(), vs(r, o), 'text')
        : e.set(r.getParentOrThrow().getKey(), r.getIndexWithinParent() + (i ? 1 : 0), 'element')
      : ((ms(n) && co(r)) || t(268), e.set(r.getKey(), i ? 0 : r.getChildrenSize(), 'element'));
}
function $s(t) {
  const e = kr(),
    n = ar(e) ? e : Nr();
  return (Us(n, t), ii(n), n);
}
function Us(t, e) {
  (Ws(t.anchor, e.anchor), Ws(t.focus, e.focus));
}
function Js(t) {
  const { anchor: e, focus: n } = t,
    r = zs(e, 'next'),
    o = zs(n, 'next'),
    i = Ls(r, o) <= 0 ? 'next' : 'previous';
  return Ps(Xs(r, i), Xs(o, i));
}
function Ys(t) {
  const { direction: e, origin: n } = t,
    r = Ns(n, ds(e)).getNodeAtCaret();
  return r ? Ns(r, e) : Es(n.getParentOrThrow(), e);
}
function js(t, e = 'root') {
  const n = [t];
  for (
    let r = ms(t) ? t.getParentCaret(e) : t.getSiblingCaret();
    null !== r;
    r = r.getParentCaret(e)
  )
    n.push(Ys(r));
  return n;
}
function Hs(t) {
  return !!t && t.origin.isAttached();
}
function Vs(e, n = 'removeEmptySlices') {
  if (e.isCollapsed()) return e;
  const r = 'root',
    o = 'next';
  let i = n;
  const s = Qs(e, o),
    l = js(s.anchor, r),
    c = js(s.focus.getFlipped(), r),
    a = new Set(),
    u = [];
  for (const t of s.iterNodeCarets(r))
    if (ms(t)) a.add(t.origin.getKey());
    else if (ys(t)) {
      const { origin: e } = t;
      (co(e) && !a.has(e.getKey())) || u.push(e);
    }
  for (const t of u) t.remove();
  for (const t of s.getTextSlices()) {
    if (!t) continue;
    const { origin: e } = t.caret,
      n = e.getTextContentSize(),
      r = Ys(Ns(e, o)),
      s = e.getMode();
    if (
      (Math.abs(t.distance) === n && 'removeEmptySlices' === i) ||
      ('token' === s && 0 !== t.distance)
    )
      r.remove();
    else if (0 !== t.distance) {
      i = 'removeEmptySlices';
      let e = t.removeTextSlice();
      const n = t.caret.origin;
      if ('segmented' === s) {
        const t = e.origin,
          n = Qn(t.getTextContent()).setStyle(t.getStyle()).setFormat(t.getFormat());
        (r.replaceOrInsert(n), (e = Ts(n, o, e.offset)));
      }
      (n.is(l[0].origin) && (l[0] = e), n.is(c[0].origin) && (c[0] = e.getFlipped()));
    }
  }
  let f, d;
  for (const t of l)
    if (Hs(t)) {
      f = Gs(t);
      break;
    }
  for (const t of c)
    if (Hs(t)) {
      d = Gs(t);
      break;
    }
  const h = (function (t, e, n) {
    if (!t || !e) return null;
    const r = t.getParentAtCaret(),
      o = e.getParentAtCaret();
    if (!r || !o) return null;
    const i = r.getParents().reverse();
    i.push(r);
    const s = o.getParents().reverse();
    s.push(o);
    const l = Math.min(i.length, s.length);
    let c;
    for (c = 0; c < l && i[c] === s[c]; c++);
    const a = (t, e) => {
        let n;
        for (let r = c; r < t.length; r++) {
          const o = t[r];
          if (Ri(o)) return;
          !n && e(o) && (n = o);
        }
        return n;
      },
      u = a(i, Xi),
      f = u && a(s, (t) => n.has(t.getKey()) && Xi(t));
    return u && f ? [u, f] : null;
  })(f, d, a);
  if (h) {
    const [t, e] = h;
    (Es(t, 'previous').splice(0, e.getChildren()), e.remove());
  }
  const g = [f, d, ...l, ...c].find(Hs);
  if (g) {
    return Ds(Xs(Gs(g), e.direction));
  }
  t(269, JSON.stringify(l.map((t) => t.origin.__key)));
}
function Gs(t) {
  const e = (function (t) {
      let e = t;
      for (; ms(e); ) {
        const t = bs(e);
        if (!ms(t)) break;
        e = t;
      }
      return e;
    })(t.getLatest()),
    { direction: n } = e;
  if (Zn(e.origin)) return ps(e) ? e : Ts(e.origin, n, n);
  const r = e.getAdjacentCaret();
  return ys(r) && Zn(r.origin) ? Ts(r.origin, n, ds(n)) : e;
}
function qs(t) {
  return ps(t) && t.offset !== vs(t.origin, t.direction);
}
function Xs(t, e) {
  return t.direction === e ? t : t.getFlipped();
}
function Qs(t, e) {
  return t.direction === e ? t : Ps(Xs(t.focus, e), Xs(t.anchor, e));
}
function Zs(t, e, n) {
  let r = Es(t, 'next');
  for (let t = 0; t < e; t++) {
    const t = r.getAdjacentCaret();
    if (null === t) break;
    r = t;
  }
  return Xs(r, n);
}
function tl(e) {
  const { origin: n, offset: r, direction: o } = e;
  if (r === vs(n, o)) return e.getSiblingCaret();
  if (r === vs(n, ds(o))) return Ys(e.getSiblingCaret());
  const [i] = n.splitText(r);
  return (Zn(i) || t(281), Xs(Ns(i, 'next'), o));
}
function el(t, e) {
  return !0;
}
((exports.$addUpdateTag = wi),
  (exports.$applyNodeReplacement = Bi),
  (exports.$caretFromPoint = zs),
  (exports.$caretRangeFromSelection = Js),
  (exports.$cloneWithProperties = ns),
  (exports.$cloneWithPropertiesEphemeral = function (t) {
    return (((e = ns(t))[vn] = !0), e);
    var e;
  }),
  (exports.$comparePointCaretNext = Ls),
  (exports.$copyNode = Ki),
  (exports.$create = function (t) {
    const e = Qi();
    return (Ur(), new (e.resolveRegisteredNodeAfterReplacements(e.getRegisteredNode(t)).klass)());
  }),
  (exports.$createLineBreakNode = In),
  (exports.$createNodeSelection = Tr),
  (exports.$createParagraphNode = No),
  (exports.$createPoint = ir),
  (exports.$createRangeSelection = Nr),
  (exports.$createRangeSelectionFromDom = function (t, e) {
    return vr(null, t, e, null);
  }),
  (exports.$createTabNode = nr),
  (exports.$createTextNode = Qn),
  (exports.$extendCaretToRange = ws),
  (exports.$findMatchingParent = ls),
  (exports.$getAdjacentChildCaret = bs),
  (exports.$getAdjacentNode = vi),
  (exports.$getAdjacentSiblingOrParentSiblingCaret = function (t, e = 'root') {
    let n = 0,
      r = t,
      o = bs(r);
    for (; null === o; ) {
      if ((n--, (o = r.getParentCaret(e)), !o)) return null;
      ((r = o), (o = bs(r)));
    }
    return o && [o, n];
  }),
  (exports.$getCaretInDirection = Xs),
  (exports.$getCaretRange = Ps),
  (exports.$getCaretRangeInDirection = Qs),
  (exports.$getCharacterOffsets = hr),
  (exports.$getChildCaret = Es),
  (exports.$getChildCaretAtIndex = Zs),
  (exports.$getChildCaretOrSelf = Os),
  (exports.$getCollapsedCaretRange = Ds),
  (exports.$getCommonAncestor = Bs),
  (exports.$getCommonAncestorResultBranchOrder = Fs),
  (exports.$getEditor = Qi),
  (exports.$getNearestNodeFromDOMNode = ti),
  (exports.$getNearestRootOrShadowRoot = Fi),
  (exports.$getNodeByKey = Xo),
  (exports.$getNodeByKeyOrThrow = Wi),
  (exports.$getNodeFromDOMNode = Qo),
  (exports.$getPreviousSelection = Er),
  (exports.$getRoot = ri),
  (exports.$getSelection = kr),
  (exports.$getSiblingCaret = Ns),
  (exports.$getState = q),
  (exports.$getStateChange = function (t, e, n) {
    const r = q(t, n, 'direct'),
      o = q(e, n, 'direct');
    return n.isEqual(r, o) ? null : [r, o];
  }),
  (exports.$getTextContent = function () {
    const t = kr();
    return null === t ? '' : t.getTextContent();
  }),
  (exports.$getTextNodeOffset = vs),
  (exports.$getTextPointCaret = Ts),
  (exports.$getTextPointCaretSlice = ks),
  (exports.$getWritableNodeState = Z),
  (exports.$hasAncestor = Pi),
  (exports.$hasUpdateTag = function (t) {
    return jr()._updateTags.has(t);
  }),
  (exports.$insertNodes = function (t) {
    let e = kr() || Er();
    (null === e && (e = ri().selectEnd()), e.insertNodes(t));
  }),
  (exports.$isBlockElementNode = function (t) {
    return co(t) && !t.isInline();
  }),
  (exports.$isChildCaret = ms),
  (exports.$isDecoratorNode = fo),
  (exports.$isEditorState = function (t) {
    return t instanceof mo;
  }),
  (exports.$isElementNode = co),
  (exports.$isExtendableTextPointCaret = qs),
  (exports.$isInlineElementOrDecoratorNode = function (t) {
    return (co(t) && t.isInline()) || (fo(t) && t.isInline());
  }),
  (exports.$isLeafNode = function (t) {
    return Zn(t) || Ln(t) || fo(t);
  }),
  (exports.$isLineBreakNode = Ln),
  (exports.$isNodeCaret = function (t) {
    return t instanceof as;
  }),
  (exports.$isNodeSelection = fr),
  (exports.$isParagraphNode = To),
  (exports.$isRangeSelection = ar),
  (exports.$isRootNode = go),
  (exports.$isRootOrShadowRoot = Ri),
  (exports.$isSiblingCaret = ys),
  (exports.$isTabNode = rr),
  (exports.$isTextNode = Zn),
  (exports.$isTextPointCaret = ps),
  (exports.$isTextPointCaretSlice = function (t) {
    return t instanceof As;
  }),
  (exports.$isTokenOrSegmented = Wo),
  (exports.$isTokenOrTab = zo),
  (exports.$nodesOfType = function (t) {
    const e = t.getType(),
      n = Yr();
    if (n._readOnly) {
      const t = es(n).get(e);
      return t ? Array.from(t.values()) : [];
    }
    const r = n._nodeMap,
      o = [];
    for (const [, n] of r) n instanceof t && n.__type === e && n.isAttached() && o.push(n);
    return o;
  }),
  (exports.$normalizeCaret = Gs),
  (exports.$normalizeSelection__EXPERIMENTAL = at),
  (exports.$onUpdate = Di),
  (exports.$parseSerializedNode = function (t) {
    return Qr(t, jr()._nodes);
  }),
  (exports.$removeTextFromCaretRange = Vs),
  (exports.$rewindSiblingCaret = Ys),
  (exports.$selectAll = function (t) {
    const e = ri();
    if (ar(t)) {
      const e = t.anchor,
        n = t.focus,
        r = e.getNode().getTopLevelElementOrThrow().getParentOrThrow();
      return (
        e.set(r.getKey(), 0, 'element'),
        n.set(r.getKey(), r.getChildrenSize(), 'element'),
        at(t),
        t
      );
    }
    {
      const t = e.select(0, e.getChildrenSize());
      return (ii(at(t)), t);
    }
  }),
  (exports.$setCompositionKey = Go),
  (exports.$setPointFromCaret = Ws),
  (exports.$setSelection = ii),
  (exports.$setSelectionFromCaretRange = $s),
  (exports.$setState = function (t, e, n) {
    let r;
    if ((Ur(), 'function' == typeof n)) {
      const o = t.getLatest(),
        i = q(o, e);
      if (((r = n(i)), e.isEqual(i, r))) return o;
    } else r = n;
    const o = t.getWritable();
    return (Z(o).updateFromKnown(e, r), o);
  }),
  (exports.$splitAtPointCaretNext = function (
    t,
    {
      $copyElementNode: e = Ki,
      $splitTextPointCaretNext: n = tl,
      rootMode: r = 'shadowRoot',
      $shouldSplit: o = el,
    } = {},
  ) {
    if (ps(t)) return n(t);
    const i = t.getParentCaret(r);
    if (i) {
      const { origin: n } = i;
      if (ms(t) && (!n.canBeEmpty() || !o(n, 'first'))) return Ys(i);
      const r = (function (t) {
        const e = [];
        for (let n = t.getAdjacentCaret(); n; n = n.getAdjacentCaret()) e.push(n.origin);
        return e;
      })(t);
      (r.length > 0 || (n.canBeEmpty() && o(n, 'last'))) && i.insert(e(n).splice(0, 0, r));
    }
    return i;
  }),
  (exports.$splitNode = function (e, n) {
    let r = e.getChildAtIndex(n);
    (null == r && (r = e), Ri(e) && t(102));
    const o = (e) => {
        const n = e.getParentOrThrow(),
          i = Ri(n),
          s = e !== r || i ? Ki(e) : e;
        if (i) return ((co(e) && co(s)) || t(133), e.insertAfter(s), [e, s, s]);
        {
          const [t, r, i] = o(n),
            l = e.getNextSiblings();
          return (i.append(s, ...l), [t, r, s]);
        }
      },
      [i, s] = o(r);
    return [i, s];
  }),
  (exports.$updateRangeSelectionFromCaretRange = Us),
  (exports.ArtificialNode__DO_NOT_USE = xo),
  (exports.BEFORE_INPUT_COMMAND = Gt),
  (exports.BLUR_COMMAND = Be),
  (exports.CAN_REDO_COMMAND = Fe),
  (exports.CAN_UNDO_COMMAND = Re),
  (exports.CLEAR_EDITOR_COMMAND = Ie),
  (exports.CLEAR_HISTORY_COMMAND = Le),
  (exports.CLICK_COMMAND = Vt),
  (exports.COLLABORATION_TAG = bn),
  (exports.COMMAND_PRIORITY_CRITICAL = 4),
  (exports.COMMAND_PRIORITY_EDITOR = vo),
  (exports.COMMAND_PRIORITY_HIGH = 3),
  (exports.COMMAND_PRIORITY_LOW = 1),
  (exports.COMMAND_PRIORITY_NORMAL = 2),
  (exports.COMPOSITION_END_COMMAND = Qt),
  (exports.COMPOSITION_START_COMMAND = Xt),
  (exports.CONTROLLED_TEXT_INSERTION_COMMAND = ne),
  (exports.COPY_COMMAND = we),
  (exports.CUT_COMMAND = De),
  (exports.DELETE_CHARACTER_COMMAND = Zt),
  (exports.DELETE_LINE_COMMAND = se),
  (exports.DELETE_WORD_COMMAND = ie),
  (exports.DRAGEND_COMMAND = Ae),
  (exports.DRAGOVER_COMMAND = Me),
  (exports.DRAGSTART_COMMAND = be),
  (exports.DROP_COMMAND = Ee),
  (exports.DecoratorNode = uo),
  (exports.ElementNode = lo),
  (exports.FOCUS_COMMAND = Ke),
  (exports.FORMAT_ELEMENT_COMMAND = Oe),
  (exports.FORMAT_TEXT_COMMAND = le),
  (exports.HISTORIC_TAG = 'historic'),
  (exports.HISTORY_MERGE_TAG = On),
  (exports.HISTORY_PUSH_TAG = 'history-push'),
  (exports.INDENT_CONTENT_COMMAND = ve),
  (exports.INPUT_COMMAND = qt),
  (exports.INSERT_LINE_BREAK_COMMAND = te),
  (exports.INSERT_PARAGRAPH_COMMAND = ee),
  (exports.INSERT_TAB_COMMAND = Te),
  (exports.INTERNAL_$isBlock = Xi),
  (exports.IS_ALL_FORMATTING = 2047),
  (exports.IS_BOLD = 1),
  (exports.IS_CODE = 16),
  (exports.IS_HIGHLIGHT = y),
  (exports.IS_ITALIC = 2),
  (exports.IS_STRIKETHROUGH = 4),
  (exports.IS_SUBSCRIPT = 32),
  (exports.IS_SUPERSCRIPT = 64),
  (exports.IS_UNDERLINE = 8),
  (exports.KEY_ARROW_DOWN_COMMAND = pe),
  (exports.KEY_ARROW_LEFT_COMMAND = he),
  (exports.KEY_ARROW_RIGHT_COMMAND = fe),
  (exports.KEY_ARROW_UP_COMMAND = _e),
  (exports.KEY_BACKSPACE_COMMAND = xe),
  (exports.KEY_DELETE_COMMAND = Se),
  (exports.KEY_DOWN_COMMAND = ue),
  (exports.KEY_ENTER_COMMAND = ye),
  (exports.KEY_ESCAPE_COMMAND = Ce),
  (exports.KEY_MODIFIER_COMMAND = ze),
  (exports.KEY_SPACE_COMMAND = me),
  (exports.KEY_TAB_COMMAND = Ne),
  (exports.LineBreakNode = Dn),
  (exports.MOVE_TO_END = de),
  (exports.MOVE_TO_START = ge),
  (exports.NODE_STATE_KEY = '$'),
  (exports.OUTDENT_CONTENT_COMMAND = ke),
  (exports.PASTE_COMMAND = re),
  (exports.PASTE_TAG = 'paste'),
  (exports.ParagraphNode = Co),
  (exports.REDO_COMMAND = ae),
  (exports.REMOVE_TEXT_COMMAND = oe),
  (exports.RootNode = ho),
  (exports.SELECTION_CHANGE_COMMAND = jt),
  (exports.SELECTION_INSERT_CLIPBOARD_NODES_COMMAND = Ht),
  (exports.SELECT_ALL_COMMAND = Pe),
  (exports.SKIP_COLLAB_TAG = 'skip-collab'),
  (exports.SKIP_DOM_SELECTION_TAG = An),
  (exports.SKIP_SCROLL_INTO_VIEW_TAG = Mn),
  (exports.SKIP_SELECTION_FOCUS_TAG = wn),
  (exports.TEXT_TYPE_TO_FORMAT = w),
  (exports.TabNode = er),
  (exports.TextNode = Un),
  (exports.UNDO_COMMAND = ce),
  (exports.buildImportMap = function (t) {
    return t;
  }),
  (exports.configExtension = function (...t) {
    return t;
  }),
  (exports.createCommand = Yt),
  (exports.createEditor = function (t) {
    const e = t || {},
      n = Vr(),
      r = e.theme || {},
      o = void 0 === t ? n : e.parentEditor || null,
      i = e.disableEvents || !1,
      s = po(),
      l = e.namespace || (null !== o ? o._config.namespace : ai()),
      c = e.editorState,
      a = [ho, Un, Dn, er, Co, xo, ...(e.nodes || [])],
      { onError: u, html: f } = e,
      d = void 0 === e.editable || e.editable;
    let h;
    if (void 0 === t && null !== n) h = n._nodes;
    else {
      h = new Map();
      for (let t = 0; t < a.length; t++) {
        let e = a[t],
          n = null,
          r = null;
        if ('function' != typeof e) {
          const t = e;
          ((e = t.replace), (n = t.with), (r = t.withKlass || null));
        }
        ss(e);
        const o = e.getType(),
          i = Eo(e);
        h.set(o, {
          exportDOM: f && f.export ? f.export.get(e) : void 0,
          klass: e,
          replace: n,
          replaceWithKlass: r,
          sharedNodeState: X(a[t]),
          transforms: i,
        });
      }
    }
    const g = new Oo(
      s,
      o,
      h,
      { disableEvents: i, namespace: l, theme: r },
      u || console.error,
      (function (t, e) {
        const n = new Map(),
          r = new Set(),
          o = (t) => {
            Object.keys(t).forEach((e) => {
              let r = n.get(e);
              (void 0 === r && ((r = []), n.set(e, r)), r.push(t[e]));
            });
          };
        return (
          t.forEach((t) => {
            const e = t.klass.importDOM;
            if (null == e || r.has(e)) return;
            r.add(e);
            const n = e.call(t.klass);
            null !== n && o(n);
          }),
          e && o(e),
          n
        );
      })(h, f ? f.import : void 0),
      d,
      t,
    );
    return (
      void 0 !== c && ((g._pendingEditorState = c), (g._dirtyType = 2)),
      (function (t) {
        (t.registerCommand(Gt, un, vo),
          t.registerCommand(qt, fn, vo),
          t.registerCommand(Xt, dn, vo),
          t.registerCommand(Qt, hn, vo),
          t.registerCommand(ue, _n, vo));
      })(g),
      g
    );
  }),
  (exports.createSharedNodeState = X),
  (exports.createState = function (t, e) {
    return new G(t, e);
  }),
  (exports.declarePeerDependency = function (t, e) {
    return [t, e];
  }),
  (exports.defineExtension = function (t) {
    return t;
  }),
  (exports.flipDirection = ds),
  (exports.getDOMOwnerDocument = Ai),
  (exports.getDOMSelection = Ji),
  (exports.getDOMSelectionFromTarget = Yi),
  (exports.getDOMTextNode = Jo),
  (exports.getEditorPropertyFromDOMNode = Bo),
  (exports.getNearestEditorFromDOMNode = Ko),
  (exports.getRegisteredNode = Do),
  (exports.getRegisteredNodeOrThrow = wo),
  (exports.getStaticNodeConfig = ss),
  (exports.getTextDirection = function (t) {
    return M.test(t) ? 'rtl' : A.test(t) ? 'ltr' : null;
  }),
  (exports.getTransformSetFromKlass = Eo),
  (exports.isBlockDomNode = qi),
  (exports.isCurrentlyReadOnlyMode = $r),
  (exports.isDOMDocumentNode = Uo),
  (exports.isDOMNode = Hi),
  (exports.isDOMTextNode = $o),
  (exports.isDOMUnmanaged = os),
  (exports.isDocumentFragment = Vi),
  (exports.isExactShortcutMatch = pi),
  (exports.isHTMLAnchorElement = function (t) {
    return ji(t) && 'A' === t.tagName;
  }),
  (exports.isHTMLElement = ji),
  (exports.isInlineDomNode = Gi),
  (exports.isLexicalEditor = Ro),
  (exports.isModifierMatch = _i),
  (exports.isSelectionCapturedInDecoratorInput = Lo),
  (exports.isSelectionWithinEditor = Fo),
  (exports.makeStepwiseIterator = Is),
  (exports.removeFromParent = Ho),
  (exports.resetRandomKey = function () {
    Ao = 1;
  }),
  (exports.safeCast = function (t) {
    return t;
  }),
  (exports.setDOMUnmanaged = function (t) {
    t.__lexicalUnmanaged = !0;
  }),
  (exports.setNodeIndentFromDOM = rs),
  (exports.shallowMergeConfig = function (t, e) {
    if (!e || t === e) return t;
    for (const n in e) if (t[n] !== e[n]) return { ...t, ...e };
    return t;
  }));
