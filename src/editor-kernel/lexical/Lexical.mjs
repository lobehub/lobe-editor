/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

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
  i = n && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
  o = n && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent),
  s =
    !(!n || !('InputEvent' in window) || r) && 'getTargetRanges' in new window.InputEvent('input'),
  l = n && /Version\/[\d.]+.*Safari/.test(navigator.userAgent),
  c = n && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  a = n && /Android/.test(navigator.userAgent),
  u = n && /^(?=.*Chrome).*/i.test(navigator.userAgent),
  f = n && a && u,
  d = n && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && i && !u;
function h(...t) {
  const e = [];
  for (const n of t) if (n && 'string' == typeof n) for (const [t] of n.matchAll(/\S+/g)) e.push(t);
  return e;
}
const g = 0,
  _ = 1,
  p = 2,
  y = 1,
  m = 2,
  x = 4,
  C = 8,
  S = 16,
  v = 32,
  k = 64,
  T = 128,
  N = 2047,
  b = 1,
  w = 2,
  E = 3,
  O = 4,
  M = 5,
  A = 6,
  P = l || c || d ? ' ' : '​',
  D = '\n\n',
  F = o ? ' ' : P,
  L = '֑-߿יִ-﷽ﹰ-ﻼ',
  I = 'A-Za-zÀ-ÖØ-öø-ʸ̀-֐ࠀ-῿‎Ⰰ-﬜︀-﹯﻽-￿',
  K = new RegExp('^[^' + I + ']*[' + L + ']'),
  z = new RegExp('^[^' + L + ']*[' + I + ']'),
  R = {
    bold: 1,
    capitalize: 1024,
    code: 16,
    highlight: T,
    italic: 2,
    lowercase: 256,
    strikethrough: 4,
    subscript: 32,
    superscript: 64,
    underline: 8,
    uppercase: 512,
  },
  B = { directionless: 1, unmergeable: 2 },
  W = { center: 2, end: 6, justify: 4, left: 1, right: 3, start: 5 },
  J = { [w]: 'center', [A]: 'end', [O]: 'justify', [b]: 'left', [E]: 'right', [M]: 'start' },
  j = { normal: 0, segmented: 2, token: 1 },
  $ = { [g]: 'normal', [p]: 'segmented', [_]: 'token' },
  U = '$',
  V = '$config';
function Y(t, e, n, r, i, o) {
  let s = t.getFirstChild();
  for (; null !== s; ) {
    const t = s.__key;
    (s.__parent === e && (Mi(s) && Y(s, t, n, r, i, o), n.has(t) || o.delete(t), i.push(t)),
      (s = s.getNextSibling()));
  }
}
let q = !1,
  H = 0;
function G(t) {
  H = t.timeStamp;
}
function X(t, e, n) {
  const r = 'BR' === t.nodeName,
    i = e.__lexicalLineBreak;
  return (i && (t === i || (r && t.previousSibling === i))) || (r && void 0 !== Mo(t, n));
}
function Q(t, e, n) {
  const r = Ns(_s(n));
  let i = null,
    o = null;
  null !== r && r.anchorNode === t && ((i = r.anchorOffset), (o = r.focusOffset));
  const s = t.nodeValue;
  null !== s && jo(e, s, i, o, !1);
}
function Z(t, e, n) {
  if (br(t)) {
    const e = t.anchor.getNode();
    if (e.is(n) && t.format !== e.getFormat()) return !1;
  }
  return mo(e) && n.isAttached();
}
function tt(t, e, n, r) {
  for (let i = t; i && !js(i); i = cs(i)) {
    const t = Mo(i, e);
    if (void 0 !== t) {
      const e = Eo(t, n);
      if (e) return Di(e) || !Os(i) ? void 0 : [i, e];
    } else if (i === r) return [r, Lo(n)];
  }
}
function et(t, e, n) {
  q = !0;
  const r = performance.now() - H > 100;
  try {
    bi(t, () => {
      const i =
          $r() ||
          (function (t) {
            return t.getEditorState().read(() => {
              const t = $r();
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
          _ = tt(g, t, c, l);
        if (!_) continue;
        const [p, y] = _;
        if ('characterData' === h) r && pr(y) && mo(g) && Z(i, g, y) && Q(g, y, t);
        else if ('childList' === h) {
          u = !0;
          const e = d.addedNodes;
          for (let n = 0; n < e.length; n++) {
            const r = e[n],
              i = Oo(r),
              s = r.parentNode;
            if (null != s && r !== a && null === i && !X(r, s, t)) {
              if (o) {
                const t = (Os(r) ? r.innerText : null) || r.nodeValue;
                t && (f += t);
              }
              s.removeChild(r);
            }
          }
          const n = d.removedNodes,
            r = n.length;
          if (r > 0) {
            let e = 0;
            for (let i = 0; i < r; i++) {
              const r = n[i];
              (X(r, g, t) || a === r) && (g.appendChild(r), e++);
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
            i = n.target;
          for (let e = 0; e < r.length; e++) {
            const n = r[e],
              o = n.parentNode;
            null == o || 'BR' !== n.nodeName || X(n, i, t) || o.removeChild(n);
          }
        }
        n.takeRecords();
      }
      null !== i && (u && Io(i), o && is(t) && i.insertRawText(f));
    });
  } finally {
    q = !1;
  }
}
function nt(t) {
  const e = t._observer;
  if (null !== e) {
    et(t, e.takeRecords(), e);
  }
}
function rt(t) {
  (!(function (t) {
    0 === H && _s(t).addEventListener('textInput', G, !0);
  })(t),
    (t._observer = new MutationObserver((e, n) => {
      et(t, e, n);
    })));
}
class it {
  key;
  parse;
  unparse;
  isEqual;
  defaultValue;
  constructor(t, e) {
    ((this.key = t),
      (this.parse = e.parse.bind(e)),
      (this.unparse = (e.unparse || gt).bind(e)),
      (this.isEqual = (e.isEqual || Object.is).bind(e)),
      (this.defaultValue = this.parse(void 0)));
  }
}
function ot(t, e) {
  return new it(t, e);
}
function st(t, e, n = 'latest') {
  const r = ('latest' === n ? t.getLatest() : t).__state;
  return r ? r.getValue(e) : e.defaultValue;
}
function lt(t, e, n) {
  const r = st(t, n, 'direct'),
    i = st(e, n, 'direct');
  return n.isEqual(r, i) ? null : [r, i];
}
function ct(t, e, n) {
  let r;
  if ((ui(), 'function' == typeof n)) {
    const i = t.getLatest(),
      o = st(i, e);
    if (((r = n(o)), e.isEqual(o, r))) return i;
  } else r = n;
  const i = t.getWritable();
  return (ft(i).updateFromKnown(e, r), i);
}
function at(t) {
  const e = new Map(),
    n = new Set();
  for (
    let r = 'function' == typeof t ? t : t.replace;
    r.prototype && void 0 !== r.prototype.getType;
    r = Object.getPrototypeOf(r)
  ) {
    const { ownNodeConfig: t } = Us(r);
    if (t && t.stateConfigs)
      for (const r of t.stateConfigs) {
        let t;
        ('stateConfig' in r ? ((t = r.stateConfig), r.flat && n.add(t.key)) : (t = r),
          e.set(t.key, t));
      }
  }
  return { flatKeys: n, sharedConfigMap: e };
}
class ut {
  node;
  knownState;
  unknownState;
  sharedNodeState;
  size;
  constructor(t, e, n = void 0, r = new Map(), i = void 0) {
    ((this.node = t), (this.sharedNodeState = e), (this.unknownState = n), (this.knownState = r));
    const { sharedConfigMap: o } = this.sharedNodeState,
      s =
        void 0 !== i
          ? i
          : (function (t, e, n) {
              let r = n.size;
              if (e)
                for (const i in e) {
                  const e = t.get(i);
                  (e && n.has(e)) || r++;
                }
              return r;
            })(o, n, r);
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
    return (ht(t) && (e.$ = t), e);
  }
  getWritable(t) {
    if (this.node === t) return this;
    const { sharedNodeState: e, unknownState: n } = this,
      r = new Map(this.knownState);
    return new ut(
      t,
      e,
      (function (t, e, n) {
        let r;
        if (n)
          for (const [i, o] of Object.entries(n)) {
            const n = t.get(i);
            n ? e.has(n) || e.set(n, n.parse(o)) : ((r = r || {}), (r[i] = o));
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
    const { knownState: r, unknownState: i } = this;
    (r.has(t) || (i && n in i) || (i && (delete i[n], (this.unknownState = ht(i))), this.size++),
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
function ft(t) {
  const e = t.getWritable(),
    n = e.__state ? e.__state.getWritable(e) : new ut(e, dt(e));
  return ((e.__state = n), n);
}
function dt(t) {
  return t.__state ? t.__state.sharedNodeState : oo(Ls(), t.getType()).sharedNodeState;
}
function ht(t) {
  if (t) for (const e in t) return t;
}
function gt(t) {
  return t;
}
function _t(t, e, n) {
  for (const [r, i] of e.knownState) {
    if (t.has(r.key)) continue;
    t.add(r.key);
    const e = n ? n.getValue(r) : r.defaultValue;
    if (e !== i && !r.isEqual(e, i)) return !0;
  }
  return !1;
}
function pt(t, e, n) {
  const { unknownState: r } = e,
    i = n ? n.unknownState : void 0;
  if (r)
    for (const [e, n] of Object.entries(r)) {
      if (t.has(e)) continue;
      t.add(e);
      if (n !== (i ? i[e] : void 0)) return !0;
    }
  return !1;
}
function yt(t, e) {
  const n = t.__state;
  return n && n.node === t ? n.getWritable(e) : n;
}
function mt(t, e) {
  const n = t.__mode,
    r = t.__format,
    i = t.__style,
    o = e.__mode,
    s = e.__format,
    l = e.__style,
    c = t.__state,
    a = e.__state;
  return (
    (null === n || n === o) &&
    (null === r || r === s) &&
    (null === i || i === l) &&
    (null === t.__state ||
      c === a ||
      (function (t, e) {
        if (t === e) return !0;
        if (t && e && t.size !== e.size) return !1;
        const n = new Set();
        return !(
          (t && _t(n, t, e)) ||
          (e && _t(n, e, t)) ||
          (t && pt(n, t, e)) ||
          (e && pt(n, e, t))
        );
      })(c, a))
  );
}
function xt(t, e) {
  const n = t.mergeWithSibling(e),
    r = hi()._normalizedNodes;
  return (r.add(t.__key), r.add(e.__key), n);
}
function Ct(t) {
  let e,
    n,
    r = t;
  if ('' !== r.__text || !r.isSimpleText() || r.isUnmergeable()) {
    for (
      ;
      null !== (e = r.getPreviousSibling()) && pr(e) && e.isSimpleText() && !e.isUnmergeable();
    ) {
      if ('' !== e.__text) {
        if (mt(e, r)) {
          r = xt(e, r);
          break;
        }
        break;
      }
      e.remove();
    }
    for (; null !== (n = r.getNextSibling()) && pr(n) && n.isSimpleText() && !n.isUnmergeable(); ) {
      if ('' !== n.__text) {
        if (mt(r, n)) {
          r = xt(r, n);
          break;
        }
        break;
      }
      n.remove();
    }
  } else r.remove();
}
function St(t) {
  return (vt(t.anchor), vt(t.focus), t);
}
function vt(t) {
  for (; 'element' === t.type; ) {
    const e = t.getNode(),
      n = t.offset;
    let r, i;
    if (
      (n === e.getChildrenSize()
        ? ((r = e.getChildAtIndex(n - 1)), (i = !0))
        : ((r = e.getChildAtIndex(n)), (i = !1)),
      pr(r))
    ) {
      t.set(r.__key, i ? r.getTextContentSize() : 0, 'text', !0);
      break;
    }
    if (!Mi(r)) break;
    t.set(r.__key, i ? r.getChildrenSize() : 0, 'element', !0);
  }
}
let kt,
  Tt,
  Nt,
  bt,
  wt,
  Et,
  Ot,
  Mt,
  At,
  Pt,
  Dt = '',
  Ft = null,
  Lt = null,
  It = '',
  Kt = !1,
  zt = !1;
function Rt(t, e) {
  const n = Ot.get(t);
  if (null !== e) {
    const n = ne(t);
    n.parentNode === e && e.removeChild(n);
  }
  if ((Mt.has(t) || Tt._keyToDOMMap.delete(t), Mi(n))) {
    const t = Xt(n, Ot);
    Bt(t, 0, t.length - 1, null);
  }
  void 0 !== n && ts(Pt, Nt, bt, n, 'destroyed');
}
function Bt(t, e, n, r) {
  let i = e;
  for (; i <= n; ++i) {
    const e = t[i];
    void 0 !== e && Rt(e, r);
  }
}
function Wt(t, e) {
  t.setProperty('text-align', e);
}
const Jt = '40px';
function jt(t, e) {
  const n = kt.theme.indent;
  if ('string' == typeof n) {
    const r = t.classList.contains(n);
    e > 0 && !r ? t.classList.add(n) : e < 1 && r && t.classList.remove(n);
  }
  const r = getComputedStyle(t).getPropertyValue('--lexical-indent-base-value') || Jt;
  t.style.setProperty('padding-inline-start', 0 === e ? '' : `calc(${e} * ${r})`);
}
function $t(t, e) {
  const n = t.style;
  0 === e
    ? Wt(n, '')
    : 1 === e
      ? Wt(n, 'left')
      : 2 === e
        ? Wt(n, 'center')
        : 3 === e
          ? Wt(n, 'right')
          : 4 === e
            ? Wt(n, 'justify')
            : 5 === e
              ? Wt(n, 'start')
              : 6 === e && Wt(n, 'end');
}
function Ut(t, e) {
  const n = (function (t) {
    const e = t.__dir;
    if (null !== e) return e;
    if (Li(t)) return null;
    const n = t.getParentOrThrow();
    return Li(n) && null === n.__dir ? 'auto' : null;
  })(e);
  null !== n ? (t.dir = n) : t.removeAttribute('dir');
}
function Vt(e, n) {
  const r = Mt.get(e);
  void 0 === r && t(60);
  const i = r.createDOM(kt, Tt);
  if (
    ((function (t, e, n) {
      const r = n._keyToDOMMap;
      ((function (t, e, n) {
        const r = `__lexicalKey_${e._key}`;
        t[r] = n;
      })(e, n, t),
        r.set(t, e));
    })(e, i, Tt),
    pr(r)
      ? i.setAttribute('data-lexical-text', 'true')
      : Di(r) && i.setAttribute('data-lexical-decorator', 'true'),
    Mi(r))
  ) {
    const t = r.__indent,
      e = r.__size;
    if ((Ut(i, r), 0 !== t && jt(i, t), 0 !== e)) {
      const t = e - 1;
      Yt(Xt(r, Mt), r, 0, t, r.getDOMSlot(i));
    }
    const n = r.__format;
    (0 !== n && $t(i, n), r.isInline() || Ht(null, r, i), ss(r) && ((Dt += D), (It += D)));
  } else {
    const t = r.getTextContent();
    if (Di(r)) {
      const t = r.decorate(Tt, kt);
      (null !== t && Zt(e, t), (i.contentEditable = 'false'));
    }
    ((Dt += t), (It += t));
  }
  return (null !== n && n.insertChild(i), ts(Pt, Nt, bt, r, 'created'), i);
}
function Yt(t, e, n, r, i) {
  const o = Dt;
  Dt = '';
  let s = n;
  for (; s <= r; ++s) {
    Vt(t[s], i);
    const e = Mt.get(t[s]);
    null !== e && pr(e) && null === Ft && ((Ft = e.getFormat()), (Lt = e.getStyle()));
  }
  ss(e) && (Dt += D);
  ((i.element.__lexicalTextContent = Dt), (Dt = o + Dt));
}
function qt(t, e) {
  if (t) {
    const n = t.__last;
    if (n) {
      const t = e.get(n);
      if (t) return Qn(t) ? 'line-break' : Di(t) && t.isInline() ? 'decorator' : null;
    }
    return 'empty';
  }
  return null;
}
function Ht(t, e, n) {
  const r = qt(t, Ot),
    i = qt(e, Mt);
  r !== i && e.getDOMSlot(n).setManagedLineBreak(i);
}
function Gt(e, n, r) {
  var i;
  ((Ft = null),
    (Lt = null),
    (function (e, n, r) {
      const i = Dt,
        o = e.__size,
        s = n.__size;
      Dt = '';
      const l = r.element;
      if (1 === o && 1 === s) {
        const t = e.__first,
          r = n.__first;
        if (t === r) Qt(t, l);
        else {
          const e = ne(t),
            n = Vt(r, null);
          try {
            l.replaceChild(n, e);
          } catch (i) {
            if ('object' == typeof i && null != i) {
              const o = `${i.toString()} Parent: ${l.tagName}, new child: {tag: ${n.tagName} key: ${r}}, old child: {tag: ${e.tagName}, key: ${t}}.`;
              throw new Error(o);
            }
            throw i;
          }
          Rt(t, null);
        }
        const i = Mt.get(r);
        pr(i) && null === Ft && ((Ft = i.getFormat()), (Lt = i.getStyle()));
      } else {
        const i = Xt(e, Ot),
          c = Xt(n, Mt);
        if ((i.length !== o && t(227), c.length !== s && t(228), 0 === o))
          0 !== s && Yt(c, n, 0, s - 1, r);
        else if (0 === s) {
          if (0 !== o) {
            const t = null == r.after && null == r.before && null == r.element.__lexicalLineBreak;
            (Bt(i, 0, o - 1, t ? null : l), t && (l.textContent = ''));
          }
        } else
          !(function (t, e, n, r, i, o) {
            const s = r - 1,
              l = i - 1;
            let c,
              a,
              u = o.getFirstChild(),
              f = 0,
              d = 0;
            for (; f <= s && d <= l; ) {
              const t = e[f],
                r = n[d];
              if (t === r) ((u = te(Qt(r, o.element))), f++, d++);
              else {
                (void 0 === c && (c = new Set(e)), void 0 === a && (a = new Set(n)));
                const i = a.has(t),
                  s = c.has(r);
                if (i)
                  if (s) {
                    const t = ls(Tt, r);
                    (t === u
                      ? (u = te(Qt(r, o.element)))
                      : (o.withBefore(u).insertChild(t), Qt(r, o.element)),
                      f++,
                      d++);
                  } else (Vt(r, o.withBefore(u)), d++);
                else ((u = te(ne(t))), Rt(t, o.element), f++);
              }
              const i = Mt.get(r);
              null !== i && pr(i) && null === Ft && ((Ft = i.getFormat()), (Lt = i.getStyle()));
            }
            const h = f > s,
              g = d > l;
            if (h && !g) {
              const e = n[l + 1],
                r = void 0 === e ? null : Tt.getElementByKey(e);
              Yt(n, t, d, l, o.withBefore(r));
            } else g && !h && Bt(e, f, s, o.element);
          })(n, i, c, o, s, r);
      }
      ss(n) && (Dt += D);
      ((l.__lexicalTextContent = Dt), (Dt = i + Dt));
    })(e, n, n.getDOMSlot(r)),
    (i = n),
    null == Ft || Ft === i.__textFormat || zt || i.setTextFormat(Ft),
    (function (t) {
      null == Lt || Lt === t.__textStyle || zt || t.setTextStyle(Lt);
    })(n));
}
function Xt(e, n) {
  const r = [];
  let i = e.__first;
  for (; null !== i; ) {
    const e = n.get(i);
    (void 0 === e && t(101), r.push(i), (i = e.__next));
  }
  return r;
}
function Qt(e, n) {
  const r = Ot.get(e);
  let i = Mt.get(e);
  (void 0 !== r && void 0 !== i) || t(61);
  const o = Kt || Et.has(e) || wt.has(e),
    s = ls(Tt, e);
  if (r === i && !o) {
    if (Mi(r)) {
      const t = s.__lexicalTextContent;
      void 0 !== t && ((Dt += t), (It += t));
    } else {
      const t = r.getTextContent();
      ((It += t), (Dt += t));
    }
    return s;
  }
  if ((r !== i && o && ts(Pt, Nt, bt, i, 'updated'), i.updateDOM(r, s, kt))) {
    const r = Vt(e, null);
    return (null === n && t(62), n.replaceChild(r, s), Rt(e, null), r);
  }
  if (Mi(r) && Mi(i)) {
    const t = i.__indent;
    (Kt || t !== r.__indent) && jt(s, t);
    const e = i.__format;
    if (
      ((Kt || e !== r.__format) && $t(s, e),
      o && (Gt(r, i, s), Li(i) || i.isInline() || Ht(r, i, s)),
      ss(i) && ((Dt += D), (It += D)),
      (Kt || i.__dir !== r.__dir) && (Ut(s, i), Li(i) && !Kt))
    )
      for (const t of i.getChildren())
        if (Mi(t)) {
          Ut(ls(Tt, t.getKey()), t);
        }
  } else {
    const t = i.getTextContent();
    if (Di(i)) {
      const t = i.decorate(Tt, kt);
      null !== t && Zt(e, t);
    }
    ((Dt += t), (It += t));
  }
  if (!zt && Li(i) && i.__cachedText !== It) {
    const t = i.getWritable();
    ((t.__cachedText = It), (i = t));
  }
  return s;
}
function Zt(t, e) {
  let n = Tt._pendingDecorators;
  const r = Tt._decorators;
  if (null === n) {
    if (r[t] === e) return;
    n = Po(Tt);
  }
  n[t] = e;
}
function te(t) {
  let e = t.nextSibling;
  return (null !== e && e === Tt._blockCursorElement && (e = e.nextSibling), e);
}
function ee(t, e, n, r, i, o) {
  ((Dt = ''),
    (It = ''),
    (Kt = 2 === r),
    (Tt = n),
    (kt = n._config),
    (Nt = n._nodes),
    (bt = Tt._listeners.mutation),
    (wt = i),
    (Et = o),
    (Ot = t._nodeMap),
    (Mt = e._nodeMap),
    (zt = e._readOnly),
    (At = new Map(n._keyToDOMMap)));
  const s = new Map();
  return (
    (Pt = s),
    Qt('root', null),
    (Tt = void 0),
    (Nt = void 0),
    (wt = void 0),
    (Et = void 0),
    (Ot = void 0),
    (Mt = void 0),
    (kt = void 0),
    (At = void 0),
    (Pt = void 0),
    s
  );
}
function ne(e) {
  const n = At.get(e);
  return (void 0 === n && t(75, e), n);
}
function re(t) {
  return { type: t };
}
const ie = re('SELECTION_CHANGE_COMMAND'),
  oe = re('SELECTION_INSERT_CLIPBOARD_NODES_COMMAND'),
  se = re('CLICK_COMMAND'),
  le = re('BEFORE_INPUT_COMMAND'),
  ce = re('INPUT_COMMAND'),
  ae = re('COMPOSITION_START_COMMAND'),
  ue = re('COMPOSITION_END_COMMAND'),
  fe = re('DELETE_CHARACTER_COMMAND'),
  de = re('INSERT_LINE_BREAK_COMMAND'),
  he = re('INSERT_PARAGRAPH_COMMAND'),
  ge = re('CONTROLLED_TEXT_INSERTION_COMMAND'),
  _e = re('PASTE_COMMAND'),
  pe = re('REMOVE_TEXT_COMMAND'),
  ye = re('DELETE_WORD_COMMAND'),
  me = re('DELETE_LINE_COMMAND'),
  xe = re('FORMAT_TEXT_COMMAND'),
  Ce = re('UNDO_COMMAND'),
  Se = re('REDO_COMMAND'),
  ve = re('KEYDOWN_COMMAND'),
  ke = re('KEY_ARROW_RIGHT_COMMAND'),
  Te = re('MOVE_TO_END'),
  Ne = re('KEY_ARROW_LEFT_COMMAND'),
  be = re('MOVE_TO_START'),
  we = re('KEY_ARROW_UP_COMMAND'),
  Ee = re('KEY_ARROW_DOWN_COMMAND'),
  Oe = re('KEY_ENTER_COMMAND'),
  Me = re('KEY_SPACE_COMMAND'),
  Ae = re('KEY_BACKSPACE_COMMAND'),
  Pe = re('KEY_ESCAPE_COMMAND'),
  De = re('KEY_DELETE_COMMAND'),
  Fe = re('KEY_TAB_COMMAND'),
  Le = re('INSERT_TAB_COMMAND'),
  Ie = re('INDENT_CONTENT_COMMAND'),
  Ke = re('OUTDENT_CONTENT_COMMAND'),
  ze = re('DROP_COMMAND'),
  Re = re('FORMAT_ELEMENT_COMMAND'),
  Be = re('DRAGSTART_COMMAND'),
  We = re('DRAGOVER_COMMAND'),
  Je = re('DRAGEND_COMMAND'),
  je = re('COPY_COMMAND'),
  $e = re('CUT_COMMAND'),
  Ue = re('SELECT_ALL_COMMAND'),
  Ve = re('CLEAR_EDITOR_COMMAND'),
  Ye = re('CLEAR_HISTORY_COMMAND'),
  qe = re('CAN_REDO_COMMAND'),
  He = re('CAN_UNDO_COMMAND'),
  Ge = re('FOCUS_COMMAND'),
  Xe = re('BLUR_COMMAND'),
  Qe = re('KEY_MODIFIER_COMMAND'),
  Ze = Object.freeze({}),
  tn = [
    [
      'keydown',
      function (t, e) {
        if (((en = t.timeStamp), (nn = t.key), e.isComposing())) return;
        os(e, ve, t);
      },
    ],
    [
      'pointerdown',
      function (t, e) {
        const n = t.target,
          r = t.pointerType;
        Ms(n) &&
          'touch' !== r &&
          'pen' !== r &&
          0 === t.button &&
          bi(e, () => {
            co(n) || (an = !0);
          });
      },
    ],
    [
      'compositionstart',
      function (t, e) {
        os(e, ae, t);
      },
    ],
    [
      'compositionend',
      function (t, e) {
        o ? (fn = !0) : c || (!l && !d) ? os(e, ue, t) : ((dn = !0), (hn = t.data));
      },
    ],
    [
      'input',
      function (t, e) {
        (t.stopPropagation(),
          bi(
            e,
            () => {
              e.dispatchCommand(ce, t);
            },
            { event: t },
          ),
          (on = null));
      },
    ],
    [
      'click',
      function (t, e) {
        bi(e, () => {
          const n = $r(),
            r = Ns(_s(e)),
            i = Ur();
          if (r)
            if (br(n)) {
              const e = n.anchor,
                o = e.getNode();
              if (
                'element' === e.type &&
                0 === e.offset &&
                n.isCollapsed() &&
                !Li(o) &&
                1 === Fo().getChildrenSize() &&
                o.getTopLevelElementOrThrow().isEmpty() &&
                null !== i &&
                n.is(i)
              )
                (r.removeAllRanges(), (n.dirty = !0));
              else if (3 === t.detail && !n.isCollapsed()) {
                if (o !== n.focus.getNode()) {
                  const t = Ys(o, (t) => Mi(t) && !t.isInline());
                  Mi(t) && t.select(0);
                }
              }
            } else if ('touch' === t.pointerType || 'pen' === t.pointerType) {
              const n = r.anchorNode;
              if (Os(n) || mo(n)) {
                Io(jr(i, r, e, t));
              }
            }
          os(e, se, t);
        });
      },
    ],
    ['cut', Ze],
    ['copy', Ze],
    ['dragstart', Ze],
    ['dragover', Ze],
    ['dragend', Ze],
    ['paste', Ze],
    ['focus', Ze],
    ['blur', Ze],
    ['drop', Ze],
  ];
s &&
  tn.push([
    'beforeinput',
    (t, e) =>
      (function (t, e) {
        const n = t.inputType;
        if ('deleteCompositionText' === n || (o && is(e))) return;
        if ('insertCompositionText' === n) return;
        os(e, le, t);
      })(t, e),
  ]);
let en = 0,
  nn = null,
  rn = 0,
  on = null;
const sn = new WeakMap(),
  ln = new WeakMap();
let cn = !1,
  an = !1,
  un = !1,
  fn = !1,
  dn = !1,
  hn = '',
  gn = null,
  _n = [0, '', 0, 'root', 0];
function pn(t, e, n, r, i) {
  const o = t.anchor,
    l = t.focus,
    c = o.getNode(),
    a = hi(),
    u = Ns(_s(a)),
    f = null !== u ? u.anchorNode : null,
    d = o.key,
    h = a.getElementByKey(d),
    g = n.length;
  return (
    d !== l.key ||
    !pr(c) ||
    (((!i && (!s || rn < r + 50)) || (c.isDirty() && g < 2) || zo(n)) &&
      o.offset !== l.offset &&
      !c.isComposing()) ||
    yo(c) ||
    (c.isDirty() && g > 1) ||
    ((i || !s) && null !== h && !c.isComposing() && f !== Co(h)) ||
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
        i = po(e);
      return 0 === n
        ? !e.canInsertTextBefore() ||
            (!r.canInsertTextBefore() && !e.isComposing()) ||
            i ||
            (function (t) {
              const e = t.getPreviousSibling();
              return (pr(e) || (Mi(e) && e.isInline())) && !e.canInsertTextAfter();
            })(e)
        : n === e.getTextContentSize() &&
            (!e.canInsertTextAfter() || (!r.canInsertTextAfter() && !e.isComposing()) || i);
    })(t, c)
  );
}
function yn(t, e) {
  return mo(t) && null !== t.nodeValue && 0 !== e && e !== t.nodeValue.length;
}
function mn(e, n, r) {
  const { anchorNode: i, anchorOffset: o, focusNode: s, focusOffset: l } = e;
  (cn && ((cn = !1), yn(i, o) && yn(s, l) && !gn)) ||
    bi(n, () => {
      if (!r) return void Io(null);
      if (!uo(n, i, s)) return;
      let c = $r();
      if (gn && br(c) && c.isCollapsed()) {
        const t = c.anchor,
          e = gn.anchor;
        ((t.key === e.key && t.offset === e.offset + 1) ||
          (1 === t.offset && e.getNode().is(t.getNode().getPreviousSibling()))) &&
          ((c = gn.clone()), Io(c));
      }
      if (((gn = null), br(c))) {
        const r = c.anchor,
          i = r.getNode();
        if (c.isCollapsed()) {
          'Range' === e.type && e.anchorNode === e.focusNode && (c.dirty = !0);
          const o = _s(n).event,
            s = o ? o.timeStamp : performance.now(),
            [l, a, u, f, d] = _n,
            h = Fo(),
            g = !1 === n.isComposing() && '' === h.getTextContent();
          if (s < d + 200 && r.offset === u && r.key === f) xn(c, l, a);
          else if ('text' === r.type) (pr(i) || t(141), Cn(c, i));
          else if ('element' === r.type && !g) {
            Mi(i) || t(259);
            const e = r.getNode();
            e.isEmpty()
              ? (function (t, e) {
                  const n = e.getTextFormat(),
                    r = e.getTextStyle();
                  xn(t, n, r);
                })(c, e)
              : xn(c, 0, '');
          }
        } else {
          const t = r.key,
            e = c.focus.key,
            n = c.getNodes(),
            i = n.length,
            s = c.isBackward(),
            a = s ? l : o,
            u = s ? o : l,
            f = s ? e : t,
            d = s ? t : e;
          let h = 2047,
            g = !1;
          for (let t = 0; t < i; t++) {
            const e = n[t],
              r = e.getTextContentSize();
            if (
              pr(e) &&
              0 !== r &&
              !(
                (0 === t && e.__key === f && a === r) ||
                (t === i - 1 && e.__key === d && 0 === u)
              ) &&
              ((g = !0), (h &= e.getFormat()), 0 === h)
            )
              break;
          }
          c.format = g ? h : 0;
        }
      }
      os(n, ie, void 0);
    });
}
function xn(t, e, n) {
  (t.format === e && t.style === n) || ((t.format = e), (t.style = n), (t.dirty = !0));
}
function Cn(t, e) {
  xn(t, e.getFormat(), e.getStyle());
}
function Sn(t) {
  if (!t.getTargetRanges) return null;
  const e = t.getTargetRanges();
  return 0 === e.length ? null : e[0];
}
function vn(e) {
  const n = e.inputType,
    r = Sn(e),
    i = hi(),
    o = $r();
  if ('deleteContentBackward' === n) {
    if (null === o) {
      const t = Ur();
      if (!br(t)) return !0;
      Io(t.clone());
    }
    if (br(o)) {
      const n = o.anchor.key === o.focus.key;
      if (((s = e.timeStamp), 'MediaLast' === nn && s < en + 30 && i.isComposing() && n)) {
        if (
          (bo(null),
          (en = 0),
          setTimeout(() => {
            bi(i, () => {
              bo(null);
            });
          }, 30),
          br(o))
        ) {
          const e = o.anchor.getNode();
          (e.markDirty(), pr(e) || t(142), Cn(o, e));
        }
      } else {
        (bo(null), e.preventDefault());
        const t = o.anchor.getNode(),
          r = t.getTextContent(),
          s = t.canInsertTextAfter(),
          l = 0 === o.anchor.offset && o.focus.offset === r.length;
        let c = f && n && !l && s;
        if ((c && o.isCollapsed() && (c = !Di(rs(o.anchor, !0))), !c)) {
          os(i, fe, !0);
          const t = $r();
          f && br(t) && t.isCollapsed() && ((gn = t), setTimeout(() => (gn = null)));
        }
      }
      return !0;
    }
  }
  var s;
  if (!br(o)) return !0;
  const l = e.data;
  (null !== on && Jo(!1, i, on),
    (o.dirty && null === on) ||
      !o.isCollapsed() ||
      Li(o.anchor.getNode()) ||
      null === r ||
      o.applyDOMRange(r),
    (on = null));
  const a = o.anchor,
    u = o.focus,
    d = a.getNode(),
    h = u.getNode();
  if ('insertText' === n || 'insertTranspose' === n) {
    if ('\n' === l) (e.preventDefault(), os(i, de, !1));
    else if (l === D) (e.preventDefault(), os(i, he, void 0));
    else if (null == l && e.dataTransfer) {
      const t = e.dataTransfer.getData('text/plain');
      (e.preventDefault(), o.insertRawText(t));
    } else
      null != l && pn(o, r, l, e.timeStamp, !0) ? (e.preventDefault(), os(i, ge, l)) : (on = l);
    return ((rn = e.timeStamp), !0);
  }
  switch ((e.preventDefault(), n)) {
    case 'insertFromYank':
    case 'insertFromDrop':
    case 'insertReplacementText':
      os(i, ge, e);
      break;
    case 'insertFromComposition':
      (bo(null), os(i, ge, e));
      break;
    case 'insertLineBreak':
      (bo(null), os(i, de, !1));
      break;
    case 'insertParagraph':
      (bo(null), un && !c ? ((un = !1), os(i, de, !1)) : os(i, he, void 0));
      break;
    case 'insertFromPaste':
    case 'insertFromPasteAsQuotation':
      os(i, _e, e);
      break;
    case 'deleteByComposition':
      (function (t, e) {
        return t !== e || Mi(t) || Mi(e) || !po(t) || !po(e);
      })(d, h) && os(i, pe, e);
      break;
    case 'deleteByDrag':
    case 'deleteByCut':
      os(i, pe, e);
      break;
    case 'deleteContent':
      os(i, fe, !1);
      break;
    case 'deleteWordBackward':
      os(i, ye, !0);
      break;
    case 'deleteWordForward':
      os(i, ye, !1);
      break;
    case 'deleteHardLineBackward':
    case 'deleteSoftLineBackward':
      os(i, me, !0);
      break;
    case 'deleteContentForward':
    case 'deleteHardLineForward':
    case 'deleteSoftLineForward':
      os(i, me, !1);
      break;
    case 'formatStrikeThrough':
      os(i, xe, 'strikethrough');
      break;
    case 'formatBold':
      os(i, xe, 'bold');
      break;
    case 'formatItalic':
      os(i, xe, 'italic');
      break;
    case 'formatUnderline':
      os(i, xe, 'underline');
      break;
    case 'historyUndo':
      os(i, Ce, void 0);
      break;
    case 'historyRedo':
      os(i, Se, void 0);
  }
  return !0;
}
function kn(t) {
  if (Os(t.target) && co(t.target)) return !0;
  const e = hi(),
    n = $r(),
    r = t.data,
    i = Sn(t);
  if (null != r && br(n) && pn(n, i, r, t.timeStamp, !1)) {
    fn && (bn(e, r), (fn = !1));
    const i = n.anchor.getNode(),
      a = Ns(_s(e));
    if (null === a) return !0;
    const u = n.isBackward(),
      f = u ? n.anchor.offset : n.focus.offset,
      h = u ? n.focus.offset : n.anchor.offset;
    (s &&
      !n.isCollapsed() &&
      pr(i) &&
      null !== a.anchorNode &&
      i.getTextContent().slice(0, f) + r + i.getTextContent().slice(f + h) === Wo(a.anchorNode)) ||
      os(e, ge, r);
    const g = r.length;
    (o &&
      g > 1 &&
      'insertCompositionText' === t.inputType &&
      !e.isComposing() &&
      (n.anchor.offset -= g),
      l || c || d || !e.isComposing() || ((en = 0), bo(null)));
  } else {
    (Jo(!1, e, null !== r ? r : void 0), fn && (bn(e, r || void 0), (fn = !1)));
  }
  return (
    (function () {
      ui();
      const t = hi();
      nt(t);
    })(),
    !0
  );
}
function Tn(t) {
  const e = hi(),
    n = $r();
  if (br(n) && !e.isComposing()) {
    const r = n.anchor,
      i = n.anchor.getNode();
    (bo(r.key),
      (t.timeStamp < en + 30 ||
        'element' === r.type ||
        !n.isCollapsed() ||
        i.getFormat() !== n.format ||
        (pr(i) && i.getStyle() !== n.style)) &&
        os(e, ge, F));
  }
  return !0;
}
function Nn(t) {
  return (bn(hi(), t.data), !0);
}
function bn(t, e) {
  const n = t._compositionKey;
  if ((bo(null), null !== n && null != e)) {
    if ('' === e) {
      const e = Eo(n),
        r = Co(t.getElementByKey(n));
      return void (
        null !== r &&
        null !== r.nodeValue &&
        pr(e) &&
        jo(e, r.nodeValue, null, null, !0)
      );
    }
    if ('\n' === e[e.length - 1]) {
      const e = $r();
      if (br(e)) {
        const n = e.focus;
        return (e.anchor.set(n.key, n.offset, n.type), void os(t, Oe, null));
      }
    }
  }
  Jo(!0, t, e);
}
function wn(t) {
  const e = hi();
  if (null == t.key) return !0;
  if (dn && Go(t))
    return (
      bi(e, () => {
        bn(e, hn);
      }),
      (dn = !1),
      (hn = ''),
      !0
    );
  if (
    (function (t) {
      return Yo(t, 'ArrowRight', { shiftKey: 'any' });
    })(t)
  )
    os(e, ke, t);
  else if (
    (function (t) {
      return Yo(t, 'ArrowRight', qo);
    })(t)
  )
    os(e, Te, t);
  else if (
    (function (t) {
      return Yo(t, 'ArrowLeft', { shiftKey: 'any' });
    })(t)
  )
    os(e, Ne, t);
  else if (
    (function (t) {
      return Yo(t, 'ArrowLeft', qo);
    })(t)
  )
    os(e, be, t);
  else if (
    (function (t) {
      return Yo(t, 'ArrowUp', { altKey: 'any', shiftKey: 'any' });
    })(t)
  )
    os(e, we, t);
  else if (
    (function (t) {
      return Yo(t, 'ArrowDown', { altKey: 'any', shiftKey: 'any' });
    })(t)
  )
    os(e, Ee, t);
  else if (
    (function (t) {
      return Yo(t, 'Enter', { altKey: 'any', ctrlKey: 'any', metaKey: 'any', shiftKey: !0 });
    })(t)
  )
    ((un = !0), os(e, Oe, t));
  else if (
    (function (t) {
      return ' ' === t.key;
    })(t)
  )
    os(e, Me, t);
  else if (
    (function (t) {
      return i && Yo(t, 'o', { ctrlKey: !0 });
    })(t)
  )
    (t.preventDefault(), (un = !0), os(e, de, !0));
  else if (
    (function (t) {
      return Yo(t, 'Enter', { altKey: 'any', ctrlKey: 'any', metaKey: 'any' });
    })(t)
  )
    ((un = !1), os(e, Oe, t));
  else if (
    (function (t) {
      return Yo(t, 'Backspace', { shiftKey: 'any' }) || (i && Yo(t, 'h', { ctrlKey: !0 }));
    })(t)
  )
    Go(t) ? os(e, Ae, t) : (t.preventDefault(), os(e, fe, !0));
  else if (
    (function (t) {
      return 'Escape' === t.key;
    })(t)
  )
    os(e, Pe, t);
  else if (
    (function (t) {
      return Yo(t, 'Delete', {}) || (i && Yo(t, 'd', { ctrlKey: !0 }));
    })(t)
  )
    !(function (t) {
      return 'Delete' === t.key;
    })(t)
      ? (t.preventDefault(), os(e, fe, !1))
      : os(e, De, t);
  else if (
    (function (t) {
      return Yo(t, 'Backspace', Ho);
    })(t)
  )
    (t.preventDefault(), os(e, ye, !0));
  else if (
    (function (t) {
      return Yo(t, 'Delete', Ho);
    })(t)
  )
    (t.preventDefault(), os(e, ye, !1));
  else if (
    (function (t) {
      return i && Yo(t, 'Backspace', { metaKey: !0 });
    })(t)
  )
    (t.preventDefault(), os(e, me, !0));
  else if (
    (function (t) {
      return i && (Yo(t, 'Delete', { metaKey: !0 }) || Yo(t, 'k', { ctrlKey: !0 }));
    })(t)
  )
    (t.preventDefault(), os(e, me, !1));
  else if (
    (function (t) {
      return Yo(t, 'b', qo);
    })(t)
  )
    (t.preventDefault(), os(e, xe, 'bold'));
  else if (
    (function (t) {
      return Yo(t, 'u', qo);
    })(t)
  )
    (t.preventDefault(), os(e, xe, 'underline'));
  else if (
    (function (t) {
      return Yo(t, 'i', qo);
    })(t)
  )
    (t.preventDefault(), os(e, xe, 'italic'));
  else if (
    (function (t) {
      return Yo(t, 'Tab', { shiftKey: 'any' });
    })(t)
  )
    os(e, Fe, t);
  else if (
    (function (t) {
      return Yo(t, 'z', qo);
    })(t)
  )
    (t.preventDefault(), os(e, Ce, void 0));
  else if (
    (function (t) {
      if (i) return Yo(t, 'z', { metaKey: !0, shiftKey: !0 });
      return Yo(t, 'y', { ctrlKey: !0 }) || Yo(t, 'z', { ctrlKey: !0, shiftKey: !0 });
    })(t)
  )
    (t.preventDefault(), os(e, Se, void 0));
  else {
    const n = e._editorState._selection;
    null === n || br(n)
      ? Xo(t) && (t.preventDefault(), os(e, Ue, t))
      : !(function (t) {
            return Yo(t, 'c', qo);
          })(t)
        ? !(function (t) {
            return Yo(t, 'x', qo);
          })(t)
          ? Xo(t) && (t.preventDefault(), os(e, Ue, t))
          : (t.preventDefault(), os(e, $e, t))
        : (t.preventDefault(), os(e, je, t));
  }
  return (
    (function (t) {
      return t.ctrlKey || t.shiftKey || t.altKey || t.metaKey;
    })(t) && e.dispatchCommand(Qe, t),
    !0
  );
}
function En(t) {
  let e = t.__lexicalEventHandles;
  return (void 0 === e && ((e = []), (t.__lexicalEventHandles = e)), e);
}
const On = new Map();
function Mn(t) {
  const e = bs(t.target);
  if (null === e) return;
  const n = ho(e.anchorNode);
  if (null === n) return;
  an &&
    ((an = !1),
    bi(n, () => {
      const r = Ur(),
        i = e.anchorNode;
      if (Os(i) || mo(i)) {
        Io(jr(r, e, n, t));
      }
    }));
  const r = Ro(n),
    i = r[r.length - 1],
    o = i._key,
    s = On.get(o),
    l = s || i;
  (l !== n && mn(e, l, !1), mn(e, n, !0), n !== i ? On.set(o, n) : s && On.delete(o));
}
function An(t) {
  t._lexicalHandled = !0;
}
function Pn(t) {
  return !0 === t._lexicalHandled;
}
const Dn = () => {};
function Fn(e) {
  const n = sn.get(e);
  if (void 0 === n) return void Dn();
  const r = ln.get(n);
  if (void 0 === r) return void Dn();
  const i = r - 1;
  (i >= 0 || t(164),
    sn.delete(e),
    ln.set(n, i),
    0 === i && n.removeEventListener('selectionchange', Mn));
  const o = go(e);
  fo(o)
    ? (!(function (t) {
        if (null !== t._parentEditor) {
          const e = Ro(t),
            n = e[e.length - 1]._key;
          On.get(n) === t && On.delete(n);
        } else On.delete(t._key);
      })(o),
      (e.__lexicalEditor = null))
    : o && t(198);
  const s = En(e);
  for (let t = 0; t < s.length; t++) s[t]();
  e.__lexicalEventHandles = [];
}
function Ln(t, e, n) {
  ui();
  const r = t.__key,
    i = t.getParent();
  if (null === i) return;
  const o = (function (t) {
    const e = $r();
    if (!br(e) || !Mi(t)) return e;
    const { anchor: n, focus: r } = e,
      i = n.getNode(),
      o = r.getNode();
    hs(i, t) && n.set(t.__key, 0, 'element');
    hs(o, t) && r.set(t.__key, 0, 'element');
    return e;
  })(t);
  let s = !1;
  if (br(o) && e) {
    const e = o.anchor,
      n = o.focus;
    (e.key === r && (qr(e, t, i, t.getPreviousSibling(), t.getNextSibling()), (s = !0)),
      n.key === r && (qr(n, t, i, t.getPreviousSibling(), t.getNextSibling()), (s = !0)));
  } else Er(o) && e && t.isSelected() && t.selectPrevious();
  if (br(o) && e && !s) {
    const e = t.getIndexWithinParent();
    (To(t), Vr(o, i, e, -1));
  } else To(t);
  (n || ms(i) || i.canBeEmpty() || !i.isEmpty() || Ln(i, e),
    e && o && Li(i) && i.isEmpty() && i.selectEnd());
}
function In(t) {
  return t;
}
const Kn = Symbol.for('ephemeral');
function zn(t) {
  return t[Kn] || !1;
}
class Rn {
  __type;
  __key;
  __parent;
  __prev;
  __next;
  __state;
  static getType() {
    const { ownNodeType: e } = Us(this);
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
      ko(this, t));
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
      const e = Eo(t);
      if (null === e) break;
      t = e.__parent;
    }
    return !1;
  }
  isSelected(t) {
    const e = t || $r();
    if (null == e) return !1;
    const n = e.getNodes().some((t) => t.__key === this.__key);
    if (pr(this)) return n;
    if (br(e) && 'element' === e.anchor.type && 'element' === e.focus.type) {
      if (e.isCollapsed()) return !1;
      const t = this.getParent();
      if (Di(this) && this.isInline() && t) {
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
    return null === t ? null : Eo(t);
  }
  getParentOrThrow() {
    const e = this.getParent();
    return (null === e && t(66, this.__key), e);
  }
  getTopLevelElement() {
    let e = this;
    for (; null !== e; ) {
      const n = e.getParent();
      if (ms(n)) return (Mi(e) || (e === this && Di(e)) || t(194), e);
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
    return null === t ? null : Eo(t);
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
    return null === t ? null : Eo(t);
  }
  getNextSiblings() {
    const t = [];
    let e = this.getNextSibling();
    for (; null !== e; ) (t.push(e), (e = e.getNextSibling()));
    return t;
  }
  getCommonAncestor(t) {
    const e = Mi(this) ? this : this.getParent(),
      n = Mi(t) ? t : t.getParent(),
      r = e && n ? wl(e, n) : null;
    return r ? r.commonAncestor : null;
  }
  is(t) {
    return null != t && this.__key === t.__key;
  }
  isBefore(e) {
    const n = wl(this, e);
    return (
      null !== n &&
      ('descendant' === n.type ||
        ('branch' === n.type
          ? -1 === Tl(n)
          : ('same' !== n.type && 'ancestor' !== n.type && t(279), !1)))
    );
  }
  isParentOf(t) {
    const e = wl(this, t);
    return null !== e && 'ancestor' === e.type;
  }
  getNodesBetween(e) {
    const n = this.isBefore(e),
      r = [],
      i = new Set();
    let o = this;
    for (; null !== o; ) {
      const s = o.__key;
      if ((i.has(s) || (i.add(s), r.push(o)), o === e)) break;
      const l = Mi(o) ? (n ? o.getFirstChild() : o.getLastChild()) : null;
      if (null !== l) {
        o = l;
        continue;
      }
      const c = n ? o.getNextSibling() : o.getPreviousSibling();
      if (null !== c) {
        o = c;
        continue;
      }
      const a = o.getParentOrThrow();
      if ((i.has(a.__key) || r.push(a), a === e)) break;
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
        null !== u || i.has(f.__key) || r.push(f);
      } while (null === u);
      o = u;
    }
    return (n || r.reverse(), r);
  }
  isDirty() {
    const t = hi()._dirtyLeaves;
    return null !== t && t.has(this.__key);
  }
  getLatest() {
    if (zn(this)) return this;
    const e = Eo(this.__key);
    return (null === e && t(113), e);
  }
  getWritable() {
    if (zn(this)) return this;
    ui();
    const t = di(),
      e = hi(),
      n = t._nodeMap,
      r = this.__key,
      i = this.getLatest(),
      o = e._cloneNotNeeded,
      s = $r();
    if ((null !== s && s.setCachedNodes(null), o.has(r))) return (No(i), i);
    const l = Rs(i);
    return (o.add(r), No(l), n.set(r, l), l);
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
      let i = r;
      for (const t of dt(n).flatKeys)
        t in e && ((void 0 !== i && i !== r) || (i = { ...r }), (i[t] = e[t]));
      return ((n.__state || i) && ft(t).updateFromJSON(i), n);
    })(this, t);
  }
  static transform() {
    return null;
  }
  remove(t) {
    Ln(this, !0, t);
  }
  replace(e, n) {
    ui();
    let r = $r();
    (null !== r && (r = r.clone()), Ss(this, e));
    const i = this.getLatest(),
      o = this.__key,
      s = e.__key,
      l = e.getWritable(),
      c = this.getParentOrThrow().getWritable(),
      a = c.__size;
    To(l);
    const u = i.getPreviousSibling(),
      f = i.getNextSibling(),
      d = i.__prev,
      h = i.__next,
      g = i.__parent;
    if ((Ln(i, !1, !0), null === u)) c.__first = s;
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
        ((Mi(this) && Mi(l)) || t(139),
        this.getChildren().forEach((t) => {
          l.append(t);
        })),
      br(r))
    ) {
      Io(r);
      const t = r.anchor,
        e = r.focus;
      (t.key === o && Tr(t, l), e.key === o && Tr(e, l));
    }
    return (wo() === o && bo(s), l);
  }
  insertAfter(t, e = !0) {
    (ui(), Ss(this, t));
    const n = this.getWritable(),
      r = t.getWritable(),
      i = r.getParent(),
      o = $r();
    let s = !1,
      l = !1;
    if (null !== i) {
      const e = t.getIndexWithinParent();
      if ((To(r), br(o))) {
        const t = i.__key,
          n = o.anchor,
          r = o.focus;
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
      e && br(o))
    ) {
      const t = this.getIndexWithinParent();
      Vr(o, a, t + 1);
      const e = a.__key;
      (s && o.anchor.set(e, t + 2, 'element'), l && o.focus.set(e, t + 2, 'element'));
    }
    return t;
  }
  insertBefore(t, e = !0) {
    (ui(), Ss(this, t));
    const n = this.getWritable(),
      r = t.getWritable(),
      i = r.__key;
    To(r);
    const o = this.getPreviousSibling(),
      s = this.getParentOrThrow().getWritable(),
      l = n.__prev,
      c = this.getIndexWithinParent();
    if (null === o) s.__first = i;
    else {
      o.getWritable().__next = i;
    }
    (s.__size++, (n.__prev = i), (r.__prev = l), (r.__next = n.__key), (r.__parent = n.__parent));
    const a = $r();
    if (e && br(a)) {
      Vr(a, this.getParentOrThrow(), c);
    }
    return t;
  }
  isParentRequired() {
    return !1;
  }
  createParentElementNode() {
    return $i();
  }
  selectStart() {
    return this.selectPrevious();
  }
  selectEnd() {
    return this.selectNext(0, 0);
  }
  selectPrevious(t, e) {
    ui();
    const n = this.getPreviousSibling(),
      r = this.getParentOrThrow();
    if (null === n) return r.select(0, 0);
    if (Mi(n)) return n.select();
    if (!pr(n)) {
      const t = n.getIndexWithinParent() + 1;
      return r.select(t, t);
    }
    return n.select(t, e);
  }
  selectNext(t, e) {
    ui();
    const n = this.getNextSibling(),
      r = this.getParentOrThrow();
    if (null === n) return r.select();
    if (Mi(n)) return n.select(0, 0);
    if (!pr(n)) {
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
const Bn = 'historic',
  Wn = 'history-push',
  Jn = 'history-merge',
  jn = 'paste',
  $n = 'collaboration',
  Un = 'skip-collab',
  Vn = 'skip-scroll-into-view',
  Yn = 'skip-dom-selection',
  qn = 'skip-selection-focus';
class Hn extends Rn {
  static getType() {
    return 'linebreak';
  }
  static clone(t) {
    return new Hn(t.__key);
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
          if (null !== e && Ds(e)) {
            const n = e.firstChild;
            if (n === t || (n.nextSibling === t && Zn(n))) {
              const n = e.lastChild;
              if (n === t || (n.previousSibling === t && Zn(n))) return !0;
            }
          }
          return !1;
        })(t) ||
        (function (t) {
          const e = t.parentElement;
          if (null !== e && Ds(e)) {
            const n = e.firstChild;
            if (n === t || (n.nextSibling === t && Zn(n))) return !1;
            const r = e.lastChild;
            if (r === t || (r.previousSibling === t && Zn(r))) return !0;
          }
          return !1;
        })(t)
          ? null
          : { conversion: Gn, priority: 0 },
    };
  }
  static importJSON(t) {
    return Xn().updateFromJSON(t);
  }
}
function Gn(t) {
  return { node: Xn() };
}
function Xn() {
  return Cs(new Hn());
}
function Qn(t) {
  return t instanceof Hn;
}
function Zn(t) {
  return mo(t) && /^( |\t|\r?\n)+$/.test(t.textContent || '');
}
function tr(t, e) {
  return 16 & e ? 'code' : e & T ? 'mark' : 32 & e ? 'sub' : 64 & e ? 'sup' : null;
}
function er(t, e) {
  return 1 & e ? 'strong' : 2 & e ? 'em' : 'span';
}
function nr(t, e, n, r, i) {
  const o = r.classList;
  let s = Zo(i, 'base');
  (void 0 !== s && o.add(...s), (s = Zo(i, 'underlineStrikethrough')));
  let l = !1;
  const c = 8 & e && 4 & e;
  void 0 !== s && (8 & n && 4 & n ? ((l = !0), c || o.add(...s)) : c && o.remove(...s));
  for (const t in R) {
    const r = R[t];
    if (((s = Zo(i, t)), void 0 !== s))
      if (n & r) {
        if (l && ('underline' === t || 'strikethrough' === t)) {
          e & r && o.remove(...s);
          continue;
        }
        (0 === (e & r) || (c && 'underline' === t) || 'strikethrough' === t) && o.add(...s);
      } else e & r && o.remove(...s);
  }
}
function rr(t, e, n) {
  const r = e.firstChild,
    i = n.isComposing(),
    s = t + (i ? P : '');
  if (null == r) e.textContent = s;
  else {
    const t = r.nodeValue;
    if (t !== s)
      if (i || o) {
        const [e, n, i] = (function (t, e) {
          const n = t.length,
            r = e.length;
          let i = 0,
            o = 0;
          for (; i < n && i < r && t[i] === e[i]; ) i++;
          for (; o + i < n && o + i < r && t[n - o - 1] === e[r - o - 1]; ) o++;
          return [i, n - i - o, e.slice(i, r - o)];
        })(t, s);
        (0 !== n && r.deleteData(e, n), r.insertData(e, i));
      } else r.nodeValue = s;
  }
}
function ir(t, e, n, r, i, o) {
  rr(i, t, e);
  const s = o.theme.text;
  void 0 !== s && nr(0, 0, r, t, s);
}
function or(t, e) {
  const n = document.createElement(e);
  return (n.appendChild(t), n);
}
class sr extends Rn {
  __text;
  __format;
  __style;
  __mode;
  __detail;
  static getType() {
    return 'text';
  }
  static clone(t) {
    return new sr(t.__text, t.__key);
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
    return $[t.__mode];
  }
  getStyle() {
    return this.getLatest().__style;
  }
  isToken() {
    return 1 === this.getLatest().__mode;
  }
  isComposing() {
    return this.__key === wo();
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
    const e = R[t];
    return 0 !== (this.getFormat() & e);
  }
  isSimpleText() {
    return 'text' === this.__type && 0 === this.__mode;
  }
  getTextContent() {
    return this.getLatest().__text;
  }
  getFormatFlags(t, e) {
    return So(this.getLatest().__format, t, e);
  }
  canHaveFormat() {
    return !0;
  }
  isInline() {
    return !0;
  }
  createDOM(t, e) {
    const n = this.__format,
      r = tr(0, n),
      i = er(0, n),
      o = null === r ? i : r,
      s = document.createElement(o);
    let l = s;
    (this.hasFormat('code') && s.setAttribute('spellcheck', 'false'),
      null !== r && ((l = document.createElement(i)), s.appendChild(l)));
    ir(l, this, 0, n, this.__text, t);
    const c = this.__style;
    return ('' !== c && (s.style.cssText = c), s);
  }
  updateDOM(e, n, r) {
    const i = this.__text,
      o = e.__format,
      s = this.__format,
      l = tr(0, o),
      c = tr(0, s),
      a = er(0, o),
      u = er(0, s);
    if ((null === l ? a : l) !== (null === c ? u : c)) return !0;
    if (l === c && a !== u) {
      const e = n.firstChild;
      null == e && t(48);
      const o = document.createElement(u);
      return (ir(o, this, 0, s, i, r), n.replaceChild(o, e), !1);
    }
    let f = n;
    (null !== c && null !== l && ((f = n.firstChild), null == f && t(49)), rr(i, f, this));
    const d = r.theme.text;
    void 0 !== d && o !== s && nr(0, o, s, f, d);
    const h = e.__style,
      g = this.__style;
    return (h !== g && (n.style.cssText = g), !1);
  }
  static importDOM() {
    return {
      '#text': () => ({ conversion: fr, priority: 0 }),
      'b': () => ({ conversion: cr, priority: 0 }),
      'code': () => ({ conversion: gr, priority: 0 }),
      'em': () => ({ conversion: gr, priority: 0 }),
      'i': () => ({ conversion: gr, priority: 0 }),
      'mark': () => ({ conversion: gr, priority: 0 }),
      's': () => ({ conversion: gr, priority: 0 }),
      'span': () => ({ conversion: lr, priority: 0 }),
      'strong': () => ({ conversion: gr, priority: 0 }),
      'sub': () => ({ conversion: gr, priority: 0 }),
      'sup': () => ({ conversion: gr, priority: 0 }),
      'u': () => ({ conversion: gr, priority: 0 }),
    };
  }
  static importJSON(t) {
    return _r().updateFromJSON(t);
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
      Os(n) || t(132),
      (n.style.whiteSpace = 'pre-wrap'),
      this.hasFormat('lowercase')
        ? (n.style.textTransform = 'lowercase')
        : this.hasFormat('uppercase')
          ? (n.style.textTransform = 'uppercase')
          : this.hasFormat('capitalize') && (n.style.textTransform = 'capitalize'),
      this.hasFormat('bold') && (n = or(n, 'b')),
      this.hasFormat('italic') && (n = or(n, 'i')),
      this.hasFormat('strikethrough') && (n = or(n, 's')),
      this.hasFormat('underline') && (n = or(n, 'u')),
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
    return ((e.__format = 'string' == typeof t ? R[t] : t), e);
  }
  setDetail(t) {
    const e = this.getWritable();
    return ((e.__detail = 'string' == typeof t ? B[t] : t), e);
  }
  setStyle(t) {
    const e = this.getWritable();
    return ((e.__style = t), e);
  }
  toggleFormat(t) {
    const e = So(this.getFormat(), t, null);
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
    const e = j[t];
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
    ui();
    let n = t,
      r = e;
    const i = $r(),
      o = this.getTextContent(),
      s = this.__key;
    if ('string' == typeof o) {
      const t = o.length;
      (void 0 === n && (n = t), void 0 === r && (r = t));
    } else ((n = 0), (r = 0));
    if (!br(i)) return Rr(s, n, s, r, 'text', 'text');
    {
      const t = wo();
      ((t !== i.anchor.key && t !== i.focus.key) || bo(s), i.setTextNodeRange(this, n, this, r));
    }
    return i;
  }
  selectStart() {
    return this.select(0, 0);
  }
  selectEnd() {
    const t = this.getTextContentSize();
    return this.select(t, t);
  }
  spliceText(t, e, n, r) {
    const i = this.getWritable(),
      o = i.__text,
      s = n.length;
    let l = t;
    l < 0 && ((l = s + l), l < 0 && (l = 0));
    const c = $r();
    if (r && br(c)) {
      const e = t + s;
      c.setTextNodeRange(i, e, i, e);
    }
    const a = o.slice(0, l) + n + o.slice(l + e);
    return ((i.__text = a), i);
  }
  canInsertTextBefore() {
    return !0;
  }
  canInsertTextAfter() {
    return !0;
  }
  splitText(...t) {
    ui();
    const e = this.getLatest(),
      n = e.getTextContent();
    if ('' === n) return [];
    const r = e.__key,
      i = wo(),
      o = n.length;
    (t.sort((t, e) => t - e), t.push(o));
    const s = [],
      l = t.length;
    for (let e = 0, r = 0; e < o && r <= l; r++) {
      const i = t[r];
      i > e && (s.push(n.slice(e, i)), (e = i));
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
    const m = $r();
    if (br(m)) {
      const [t, e] = m.isBackward() ? [m.focus, m.anchor] : [m.anchor, m.focus];
      ('text' === t.type && t.key === r && (p = t), 'text' === e.type && e.key === r && (y = e));
    }
    e.isSegmented()
      ? ((f = _r(a)),
        (f.__format = d),
        (f.__style = h),
        (f.__detail = g),
        (f.__state = yt(e, f)),
        (_ = !0))
      : (f = e.setTextContent(a));
    const x = [f];
    for (let t = 1; t < c; t++) {
      const n = _r(s[t]);
      ((n.__format = d), (n.__style = h), (n.__detail = g), (n.__state = yt(e, n)));
      const o = n.__key;
      (i === r && bo(o), x.push(n));
    }
    const C = p ? p.offset : null,
      S = y ? y.offset : null;
    let v = 0;
    for (const t of x) {
      if (!p && !y) break;
      const e = v + t.getTextContentSize();
      if (
        (null !== p &&
          null !== C &&
          C <= e &&
          C >= v &&
          (p.set(t.getKey(), C - v, 'text'), C < e && (p = null)),
        null !== y && null !== S && S <= e && S >= v)
      ) {
        y.set(t.getKey(), S - v, 'text');
        break;
      }
      v = e;
    }
    if (null !== u) {
      !(function (t) {
        const e = t.getPreviousSibling(),
          n = t.getNextSibling();
        null !== e && No(e);
        null !== n && No(n);
      })(this);
      const t = u.getWritable(),
        e = this.getIndexWithinParent();
      (_ ? (t.splice(e, 0, x), this.remove()) : t.splice(e, 1, x), br(m) && Vr(m, u, e, c - 1));
    }
    return x;
  }
  mergeWithSibling(e) {
    const n = e === this.getPreviousSibling();
    n || e === this.getNextSibling() || t(50);
    const r = this.__key,
      i = e.__key,
      o = this.__text,
      s = o.length;
    wo() === i && bo(r);
    const l = $r();
    if (br(l)) {
      const t = l.anchor,
        o = l.focus;
      (null !== t && t.key === i && Hr(t, n, r, e, s),
        null !== o && o.key === i && Hr(o, n, r, e, s));
    }
    const c = e.__text,
      a = n ? c + o : o + c;
    this.setTextContent(a);
    const u = this.getWritable();
    return (e.remove(), u);
  }
  isTextEntity() {
    return !1;
  }
}
function lr(t) {
  return { forChild: yr(t.style), node: null };
}
function cr(t) {
  const e = t,
    n = 'normal' === e.style.fontWeight;
  return { forChild: yr(e.style, n ? void 0 : 'bold'), node: null };
}
const ar = new WeakMap();
function ur(t) {
  if (!Os(t)) return !1;
  if ('PRE' === t.nodeName) return !0;
  const e = t.style.whiteSpace;
  return 'string' == typeof e && e.startsWith('pre');
}
function fr(e) {
  const n = e;
  null === e.parentElement && t(129);
  let r = n.textContent || '';
  if (
    null !==
    (function (t) {
      let e,
        n = t.parentNode;
      const r = [t];
      for (; null !== n && void 0 === (e = ar.get(n)) && !ur(n); ) (r.push(n), (n = n.parentNode));
      const i = void 0 === e ? n : e;
      for (let t = 0; t < r.length; t++) ar.set(r[t], i);
      return i;
    })(n)
  ) {
    const t = r.split(/(\r?\n|\t)/),
      e = [],
      n = t.length;
    for (let r = 0; r < n; r++) {
      const n = t[r];
      '\n' === n || '\r\n' === n
        ? e.push(Xn())
        : '\t' === n
          ? e.push(xr())
          : '' !== n && e.push(_r(n));
    }
    return { node: e };
  }
  if (((r = r.replace(/\r/g, '').replace(/[ \t\n]+/g, ' ')), '' === r)) return { node: null };
  if (' ' === r[0]) {
    let t = n,
      e = !0;
    for (; null !== t && null !== (t = dr(t, !1)); ) {
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
    for (; null !== t && null !== (t = dr(t, !0)); ) {
      if ((t.textContent || '').replace(/^( |\t|\r?\n)+/, '').length > 0) {
        e = !1;
        break;
      }
    }
    e && (r = r.slice(0, r.length - 1));
  }
  return '' === r ? { node: null } : { node: _r(r) };
}
function dr(t, e) {
  let n = t;
  for (;;) {
    let t;
    for (; null === (t = e ? n.nextSibling : n.previousSibling); ) {
      const t = n.parentElement;
      if (null === t) return null;
      n = t;
    }
    if (((n = t), Os(n))) {
      const t = n.style.display;
      if (('' === t && !Ps(n)) || ('' !== t && !t.startsWith('inline'))) return null;
    }
    let r = n;
    for (; null !== (r = e ? n.firstChild : n.lastChild); ) n = r;
    if (mo(n)) return n;
    if ('BR' === n.nodeName) return null;
  }
}
const hr = {
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
function gr(t) {
  const e = hr[t.nodeName.toLowerCase()];
  return void 0 === e ? { node: null } : { forChild: yr(t.style, e), node: null };
}
function _r(t = '') {
  return Cs(new sr(t));
}
function pr(t) {
  return t instanceof sr;
}
function yr(t, e) {
  const n = t.fontWeight,
    r = t.textDecoration.split(' '),
    i = '700' === n || 'bold' === n,
    o = r.includes('line-through'),
    s = 'italic' === t.fontStyle,
    l = r.includes('underline'),
    c = t.verticalAlign;
  return (t) =>
    pr(t)
      ? (i && !t.hasFormat('bold') && t.toggleFormat('bold'),
        o && !t.hasFormat('strikethrough') && t.toggleFormat('strikethrough'),
        s && !t.hasFormat('italic') && t.toggleFormat('italic'),
        l && !t.hasFormat('underline') && t.toggleFormat('underline'),
        'sub' !== c || t.hasFormat('subscript') || t.toggleFormat('subscript'),
        'super' !== c || t.hasFormat('superscript') || t.toggleFormat('superscript'),
        e && !t.hasFormat(e) && t.toggleFormat(e),
        t)
      : t;
}
class mr extends sr {
  static getType() {
    return 'tab';
  }
  static clone(t) {
    return new mr(t.__key);
  }
  constructor(t) {
    (super('\t', t), (this.__detail = 2));
  }
  static importDOM() {
    return null;
  }
  createDOM(t) {
    const e = super.createDOM(t),
      n = Zo(t.theme, 'tab');
    if (void 0 !== n) {
      e.classList.add(...n);
    }
    return e;
  }
  static importJSON(t) {
    return xr().updateFromJSON(t);
  }
  setTextContent(t) {
    return ('\t' !== t && '' !== t && e(126), super.setTextContent('\t'));
  }
  spliceText(e, n, r, i) {
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
function xr() {
  return Cs(new mr());
}
function Cr(t) {
  return t instanceof mr;
}
class Sr {
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
    return kl(Kl(El(this, 'next')), Kl(El(t, 'next'))) < 0;
  }
  getNode() {
    const e = Eo(this.key);
    return (null === e && t(20), e);
  }
  set(t, e, n, r) {
    const i = this._selection,
      o = this.key;
    (r && this.key === t && this.offset === e && this.type === n) ||
      ((this.key = t),
      (this.offset = e),
      (this.type = n),
      ai() || (wo() === o && bo(t), null !== i && (i.setCachedNodes(null), (i.dirty = !0))));
  }
}
function vr(t, e, n) {
  return new Sr(t, e, n);
}
function kr(t, e) {
  let n = e.__key,
    r = t.offset,
    i = 'element';
  if (pr(e)) {
    i = 'text';
    const t = e.getTextContentSize();
    r > t && (r = t);
  } else if (!Mi(e)) {
    const t = e.getNextSibling();
    if (pr(t)) ((n = t.__key), (r = 0), (i = 'text'));
    else {
      const t = e.getParent();
      t && ((n = t.__key), (r = e.getIndexWithinParent() + 1));
    }
  }
  t.set(n, r, i);
}
function Tr(t, e) {
  if (Mi(e)) {
    const n = e.getLastDescendant();
    Mi(n) || pr(n) ? kr(t, n) : kr(t, e);
  } else kr(t, e);
}
class Nr {
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
    if (!Er(t)) return !1;
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
    return new Nr(new Set(this._nodes));
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
    let i;
    if (pr(r)) i = r.select();
    else {
      const t = r.getIndexWithinParent() + 1;
      i = r.getParentOrThrow().select(t, t);
    }
    i.insertNodes(t);
    for (let t = 0; t < n; t++) e[t].remove();
  }
  getNodes() {
    const t = this._cachedNodes;
    if (null !== t) return t;
    const e = this._nodes,
      n = [];
    for (const t of e) {
      const e = Eo(t);
      null !== e && n.push(e);
    }
    return (ai() || (this._cachedNodes = n), n);
  }
  getTextContent() {
    const t = this.getNodes();
    let e = '';
    for (let n = 0; n < t.length; n++) e += t[n].getTextContent();
    return e;
  }
  deleteNodes() {
    const t = this.getNodes();
    if (($r() || Ur()) === this && t[0]) {
      const e = al(t[0], 'next');
      Ml(Sl(e, e));
    }
    for (const e of t) e.remove();
  }
}
function br(t) {
  return t instanceof wr;
}
class wr {
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
      !!br(t) &&
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
      const i = new Set(),
        o = new Set();
      for (const n of t)
        if (ol(n)) {
          const { origin: t } = n;
          0 === e.length ? i.add(t) : (o.add(t), e.push(t));
        } else {
          const { origin: t } = n;
          (Mi(t) && o.has(t)) || e.push(t);
        }
      r && e.push(r.caret.origin);
      if (il(t.focus) && Mi(t.focus.origin) && null === t.focus.getNodeAtCaret())
        for (
          let n = hl(t.focus.origin, 'previous');
          ol(n) && i.has(n.origin) && !n.origin.isEmpty() && n.origin.is(e[e.length - 1]);
          n = _l(n)
        )
          (i.delete(n.origin), e.pop());
      for (; e.length > 1; ) {
        const t = e[e.length - 1];
        if (!Mi(t) || o.has(t) || t.isEmpty() || i.has(t)) break;
        e.pop();
      }
      if (0 === e.length && t.isCollapsed()) {
        const n = Kl(t.anchor),
          r = Kl(t.anchor.getFlipped()),
          i = (t) => (nl(t) ? t.origin : t.getNodeAtCaret()),
          o = i(n) || i(r) || (t.anchor.getNodeAtCaret() ? n.origin : r.origin);
        e.push(o);
      }
      return e;
    })(Bl(Pl(this), 'next'));
    return (ai() || (this._cachedNodes = e), e);
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
      i = this.focus,
      o = r.isBefore(i),
      [s, l] = Mr(this);
    let c = '',
      a = !0;
    for (let u = 0; u < t.length; u++) {
      const f = t[u];
      if (Mi(f) && !f.isInline()) (a || (c += '\n'), (a = !f.isEmpty()));
      else if (((a = !1), pr(f))) {
        let t = f.getTextContent();
        (f === e
          ? f === n
            ? ('element' === r.type && 'element' === i.type && i.offset !== r.offset) ||
              (t = s < l ? t.slice(s, l) : t.slice(l, s))
            : (t = o ? t.slice(s) : t.slice(l))
          : f === n && (t = o ? t.slice(0, l) : t.slice(0, s)),
          (c += t));
      } else (!Di(f) && !Qn(f)) || (f === n && this.isCollapsed()) || (c += f.getTextContent());
    }
    return c;
  }
  applyDOMRange(t) {
    const e = hi(),
      n = e.getEditorState()._selection,
      r = Kr(t.startContainer, t.startOffset, t.endContainer, t.endOffset, e, n);
    if (null === r) return;
    const [i, o] = r;
    (this.anchor.set(i.key, i.offset, i.type, !0),
      this.focus.set(o.key, o.offset, o.type, !0),
      St(this));
  }
  clone() {
    const t = this.anchor,
      e = this.focus;
    return new wr(
      vr(t.key, t.offset, t.type),
      vr(e.key, e.offset, e.type),
      this.format,
      this.style,
    );
  }
  toggleFormat(t) {
    ((this.format = So(this.format, t, null)), (this.dirty = !0));
  }
  setFormat(t) {
    ((this.format = t), (this.dirty = !0));
  }
  setStyle(t) {
    ((this.style = t), (this.dirty = !0));
  }
  hasFormat(t) {
    const e = R[t];
    return 0 !== (this.format & e);
  }
  insertRawText(t) {
    const e = t.split(/(\r?\n|\t)/),
      n = [],
      r = e.length;
    for (let t = 0; t < r; t++) {
      const r = e[t];
      '\n' === r || '\r\n' === r ? n.push(Xn()) : '\t' === r ? n.push(xr()) : n.push(_r(r));
    }
    this.insertNodes(n);
  }
  insertText(e) {
    const n = this.anchor,
      r = this.focus,
      i = this.format,
      o = this.style;
    let s = n,
      l = r;
    (!this.isCollapsed() && r.isBefore(n) && ((s = r), (l = n)),
      'element' === s.type &&
        (function (t, e, n, r) {
          const i = t.getNode(),
            o = i.getChildAtIndex(t.offset),
            s = _r();
          if ((s.setFormat(n), s.setStyle(r), Ui(o))) o.splice(0, 0, [s]);
          else {
            const t = Li(i) ? $i().append(s) : s;
            null === o ? i.append(t) : o.insertBefore(t);
          }
          (t.is(e) && e.set(s.__key, 0, 'text'), t.set(s.__key, 0, 'text'));
        })(s, l, i, o),
      'element' === l.type && Ol(l, Kl(El(l, 'next'))));
    const c = s.offset;
    let a = l.offset;
    const u = this.getNodes(),
      f = u.length;
    let d = u[0];
    pr(d) || t(26);
    const h = d.getTextContent().length,
      g = d.getParentOrThrow();
    let _ = u[f - 1];
    if (
      (1 === f && 'element' === l.type && ((a = h), l.set(s.key, a, 'text')),
      this.isCollapsed() &&
        c === h &&
        (yo(d) ||
          !d.canInsertTextAfter() ||
          (!g.canInsertTextAfter() && null === d.getNextSibling())))
    ) {
      let t = d.getNextSibling();
      if (
        ((pr(t) && t.canInsertTextBefore() && !yo(t)) ||
          ((t = _r()),
          t.setFormat(i),
          t.setStyle(o),
          g.canInsertTextAfter() ? d.insertAfter(t) : g.insertAfter(t)),
        t.select(0, 0),
        (d = t),
        '' !== e)
      )
        return void this.insertText(e);
    } else if (
      this.isCollapsed() &&
      0 === c &&
      (yo(d) ||
        !d.canInsertTextBefore() ||
        (!g.canInsertTextBefore() && null === d.getPreviousSibling()))
    ) {
      let t = d.getPreviousSibling();
      if (
        ((pr(t) && !yo(t)) ||
          ((t = _r()),
          t.setFormat(i),
          g.canInsertTextBefore() ? d.insertBefore(t) : g.insertBefore(t)),
        t.select(),
        (d = t),
        '' !== e)
      )
        return void this.insertText(e);
    } else if (d.isSegmented() && c !== h) {
      const t = _r(d.getTextContent());
      (t.setFormat(i), d.replace(t), (d = t));
    } else if (!this.isCollapsed() && '' !== e) {
      const t = _.getParent();
      if (
        !g.canInsertTextBefore() ||
        !g.canInsertTextAfter() ||
        (Mi(t) && (!t.canInsertTextBefore() || !t.canInsertTextAfter()))
      )
        return (this.insertText(''), Ir(this.anchor, this.focus, null), void this.insertText(e));
    }
    if (1 === f) {
      if (po(d)) {
        const t = _r(e);
        return (t.select(), void d.replace(t));
      }
      const t = d.getFormat(),
        n = d.getStyle();
      if (c !== a || (t === i && n === o)) {
        if (Cr(d)) {
          const t = _r(e);
          return (t.setFormat(i), t.setStyle(o), t.select(), void d.replace(t));
        }
      } else {
        if ('' !== d.getTextContent()) {
          const t = _r(e);
          if ((t.setFormat(i), t.setStyle(o), t.select(), 0 === c)) d.insertBefore(t, !1);
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
        (d.setFormat(i), d.setStyle(o));
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
        n = Mi(d) ? d : d.getParentOrThrow();
      let r = Mi(_) ? _ : _.getParentOrThrow(),
        i = _;
      if (!n.is(r) && r.isInline())
        do {
          ((i = r), (r = r.getParentOrThrow()));
        } while (r.isInline());
      if (
        ('text' === l.type && (0 !== a || '' === _.getTextContent())) ||
        ('element' === l.type && _.getIndexWithinParent() < a)
      )
        if (pr(_) && !po(_) && a !== _.getTextContentSize()) {
          if (_.isSegmented()) {
            const t = _r(_.getTextContent());
            (_.replace(t), (_ = t));
          }
          (Li(l.getNode()) || 'text' !== l.type || (_ = _.spliceText(0, a, '')), t.add(_.__key));
        } else {
          const t = _.getParentOrThrow();
          t.canBeEmpty() || 1 !== t.getChildrenSize() ? _.remove() : t.remove();
        }
      else t.add(_.__key);
      const o = r.getChildren(),
        s = new Set(u),
        g = n.is(r),
        p = n.isInline() && null === d.getNextSibling() ? n : d;
      for (let t = o.length - 1; t >= 0; t--) {
        const e = o[t];
        if (e.is(d) || (Mi(e) && e.isParentOf(d))) break;
        e.isAttached() && (!s.has(e) || e.is(i) ? g || p.insertAfter(e, !1) : e.remove());
      }
      if (!g) {
        let e = r,
          n = null;
        for (; null !== e; ) {
          const r = e.getChildren(),
            i = r.length;
          ((0 === i || r[i - 1].is(n)) && (t.delete(e.__key), (n = e)), (e = e.getParent()));
        }
      }
      if (po(d))
        if (c === h) d.select();
        else {
          const t = _r(e);
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
    const t = $r() === this;
    (Al(this, Il(Pl(this))), t && $r() !== this && Io(this));
  }
  formatText(t, e = null) {
    if (this.isCollapsed()) return (this.toggleFormat(t), void bo(null));
    const n = this.getNodes(),
      r = [];
    for (const t of n) pr(t) && r.push(t);
    const i = (e) => {
        n.forEach((n) => {
          if (Mi(n)) {
            const r = n.getFormatFlags(t, e);
            n.setTextFormat(r);
          }
        });
      },
      o = r.length;
    if (0 === o) return (this.toggleFormat(t), bo(null), void i(e));
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
    i(g);
    const _ = o - 1;
    let p = r[_];
    const y = 'text' === u.type ? u.offset : p.getTextContentSize();
    if (d.is(p)) {
      if (h === y) return;
      if (yo(d) || (0 === h && y === d.getTextContentSize())) d.setFormat(g);
      else {
        const t = d.splitText(h, y),
          e = 0 === h ? t[0] : t[1];
        (e.setFormat(g),
          'text' === a.type && a.set(e.__key, 0, 'text'),
          'text' === u.type && u.set(e.__key, y - h, 'text'));
      }
      return void (this.format = g);
    }
    (0 === h || yo(d) || (([, d] = d.splitText(h)), (h = 0)), d.setFormat(g));
    const m = p.getFormatFlags(t, g);
    y > 0 && (y === p.getTextContentSize() || yo(p) || ([p] = p.splitText(y)), p.setFormat(m));
    for (let e = f + 1; e < _; e++) {
      const n = r[e],
        i = n.getFormatFlags(t, m);
      n.setFormat(i);
    }
    ('text' === a.type && a.set(d.__key, h, 'text'),
      'text' === u.type && u.set(p.__key, y, 'text'),
      (this.format = g | m));
  }
  insertNodes(e) {
    if (0 === e.length) return;
    if ((this.isCollapsed() || this.removeText(), 'root' === this.anchor.key)) {
      this.insertParagraph();
      const n = $r();
      return (br(n) || t(134), n.insertNodes(e));
    }
    const n = (this.isBackward() ? this.focus : this.anchor).getNode(),
      r = Ys(n, Fs),
      i = e[e.length - 1];
    if (Mi(r) && '__language' in r) {
      if ('__language' in e[0]) this.insertText(e[0].getTextContent());
      else {
        const t = ti(this);
        (r.splice(t, 0, e), i.selectEnd());
      }
      return;
    }
    if (!e.some((t) => (Mi(t) || Di(t)) && !t.isInline())) {
      Mi(r) || t(211, n.constructor.name, n.getType());
      const o = ti(this);
      return (r.splice(o, 0, e), void i.selectEnd());
    }
    const o = (function (t) {
        const e = $i();
        let n = null;
        for (let r = 0; r < t.length; r++) {
          const i = t[r],
            o = Qn(i);
          if (
            o ||
            (Di(i) && i.isInline()) ||
            (Mi(i) && i.isInline()) ||
            pr(i) ||
            i.isParentRequired()
          ) {
            if (null === n && ((n = i.createParentElementNode()), e.append(n), o)) continue;
            null !== n && n.append(i);
          } else (e.append(i), (n = null));
        }
        return e;
      })(e),
      s = o.getLastDescendant(),
      l = o.getChildren(),
      c = !Mi(r) || !r.isEmpty() ? this.insertParagraph() : null,
      a = l[l.length - 1];
    let u = l[0];
    var f;
    (Mi((f = u)) &&
      Fs(f) &&
      !f.isEmpty() &&
      Mi(r) &&
      (!r.isEmpty() || r.canMergeWhenEmpty()) &&
      (Mi(r) || t(211, n.constructor.name, n.getType()), r.append(...u.getChildren()), (u = l[1])),
      u &&
        (null === r && t(212, n.constructor.name, n.getType()),
        (function (e, n) {
          const r = n.getParentOrThrow().getLastChild();
          let i = n;
          const o = [n];
          for (; i !== r; ) (i.getNextSibling() || t(140), (i = i.getNextSibling()), o.push(i));
          let s = e;
          for (const t of o) s = s.insertAfter(t);
        })(r, u)));
    const d = Ys(s, Fs);
    (c && Mi(d) && (c.canMergeWhenEmpty() || Fs(a)) && (d.append(...c.getChildren()), c.remove()),
      Mi(r) && r.isEmpty() && r.remove(),
      s.selectEnd());
    const h = Mi(r) ? r.getLastChild() : null;
    Qn(h) && d !== r && h.remove();
  }
  insertParagraph() {
    if ('root' === this.anchor.key) {
      const t = $i();
      return (Fo().splice(this.anchor.offset, 0, [t]), t.select(), t);
    }
    const e = ti(this),
      n = Ys(this.anchor.getNode(), Fs);
    Mi(n) || t(213);
    const r = n.getChildAtIndex(e),
      i = r ? [r, ...r.getNextSiblings()] : [],
      o = n.insertNewAfter(this, !1);
    return o ? (o.append(...i), o.selectStart(), o) : null;
  }
  insertLineBreak(t) {
    const e = Xn();
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
    const [i, o] = Mr(this),
      s = this.isBackward(),
      [l, c] = s ? [this.focus, this.anchor] : [this.anchor, this.focus],
      [a, u] = s ? [o, i] : [i, o];
    if (0 === e) return [];
    if (1 === e) {
      if (pr(n) && !this.isCollapsed()) {
        const t = n.splitText(a, u),
          e = 0 === a ? t[0] : t[1];
        return e
          ? (l.set(e.getKey(), 0, 'text'), c.set(e.getKey(), e.getTextContentSize(), 'text'), [e])
          : [];
      }
      return [n];
    }
    if (
      (pr(n) &&
        (a === n.getTextContentSize()
          ? t.shift()
          : 0 !== a && (([, n] = n.splitText(a)), (t[0] = n), l.set(n.getKey(), 0, 'text'))),
      pr(r))
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
    if (ni(this, t, e, n)) return;
    const r = 'move' === t,
      i = hi(),
      o = Ns(_s(i));
    if (!o) return;
    const s = i._blockCursorElement,
      l = i._rootElement,
      c = this.focus.getNode();
    if (
      (null === l || null === s || !Mi(c) || c.isInline() || c.canBeEmpty() || Ts(s, i, l),
      this.dirty)
    ) {
      let t = ls(i, this.anchor.key),
        e = ls(i, this.focus.key);
      ('text' === this.anchor.type && (t = Co(t)),
        'text' === this.focus.type && (e = Co(e)),
        t && e && Gr(o, t, this.anchor.offset, e, this.focus.offset));
    }
    if (
      ((function (t, e, n, r) {
        t.modify(e, n, r);
      })(o, t, e ? 'backward' : 'forward', n),
      o.rangeCount > 0)
    ) {
      const t = o.getRangeAt(0),
        n = this.anchor.getNode(),
        i = Li(n) ? n : ys(n);
      if ((this.applyDOMRange(t), (this.dirty = !0), !r)) {
        const n = this.getNodes(),
          r = [];
        let s = !1;
        for (let t = 0; t < n.length; t++) {
          const e = n[t];
          hs(e, i) ? r.push(e) : (s = !0);
        }
        if (s && r.length > 0)
          if (e) {
            const t = r[0];
            Mi(t) ? t.selectStart() : t.getParentOrThrow().selectStart();
          } else {
            const t = r[r.length - 1];
            Mi(t) ? t.selectEnd() : t.getParentOrThrow().selectEnd();
          }
        (o.anchorNode === t.startContainer && o.anchorOffset === t.startOffset) ||
          (function (t) {
            const e = t.focus,
              n = t.anchor,
              r = n.key,
              i = n.offset,
              o = n.type;
            (n.set(e.key, e.offset, e.type, !0), e.set(r, i, o, !0));
          })(this);
      }
    }
    'lineboundary' === n && ni(this, t, e, n, 'decorators');
  }
  forwardDeletion(t, e, n) {
    if (
      !n &&
      (('element' === t.type && Mi(e) && t.offset === e.getChildrenSize()) ||
        ('text' === t.type && t.offset === e.getTextContentSize()))
    ) {
      const t = e.getParent(),
        n = e.getNextSibling() || (null === t ? null : t.getNextSibling());
      if (Mi(n) && n.isShadowRoot()) return !0;
    }
    return !1;
  }
  deleteCharacter(t) {
    const e = this.isCollapsed();
    if (this.isCollapsed()) {
      const e = this.anchor;
      let n = e.getNode();
      if (this.forwardDeletion(e, n, t)) return;
      const r = xl(El(e, t ? 'previous' : 'next'));
      if (r.getTextSlices().every((t) => null === t || 0 === t.distance)) {
        let t = { type: 'initial' };
        for (const e of r.iterNodeCarets('shadowRoot'))
          if (ol(e))
            if (e.origin.isInline());
            else {
              if (e.origin.isShadowRoot()) {
                if ('merge-block' === t.type) break;
                if (Mi(r.anchor.origin) && r.anchor.origin.isEmpty()) {
                  const t = Kl(e);
                  (Al(this, Sl(t, t)), r.anchor.origin.remove());
                }
                return;
              }
              ('merge-next-block' !== t.type && 'merge-block' !== t.type) ||
                (t = { block: t.block, caret: e, type: 'merge-block' });
            }
          else {
            if ('merge-block' === t.type) break;
            if (il(e)) {
              if (Mi(e.origin)) {
                if (e.origin.isInline()) {
                  if (!e.origin.isParentOf(r.anchor.origin)) break;
                } else t = { block: e.origin, type: 'merge-next-block' };
                continue;
              }
              if (Di(e.origin)) {
                if (e.origin.isIsolated());
                else if (
                  'merge-next-block' === t.type &&
                  (e.origin.isKeyboardSelectable() || !e.origin.isInline()) &&
                  Mi(r.anchor.origin) &&
                  r.anchor.origin.isEmpty()
                ) {
                  r.anchor.origin.remove();
                  const t = Wr();
                  (t.add(e.origin.getKey()), Io(t));
                } else e.origin.remove();
                return;
              }
              break;
            }
          }
        if ('merge-block' === t.type) {
          const { caret: e, block: n } = t;
          return (
            Al(this, Sl(!e.origin.isEmpty() && n.isEmpty() ? Dl(al(n, e.direction)) : r.anchor, e)),
            this.removeText()
          );
        }
      }
      const i = this.focus;
      if ((this.modify('extend', t, 'character'), this.isCollapsed())) {
        if (t && 0 === e.offset && Ar(this, e.getNode())) return;
      } else {
        const r = 'text' === i.type ? i.getNode() : null;
        if (((n = 'text' === e.type ? e.getNode() : null), null !== r && r.isSegmented())) {
          const e = i.offset,
            o = r.getTextContentSize();
          if (r.is(n) || (t && e !== o) || (!t && 0 !== e)) return void Dr(r, t, e);
        } else if (null !== n && n.isSegmented()) {
          const i = e.offset,
            o = n.getTextContentSize();
          if (n.is(r) || (t && 0 !== i) || (!t && i !== o)) return void Dr(n, t, i);
        }
        !(function (t, e) {
          const n = t.anchor,
            r = t.focus,
            i = n.getNode(),
            o = r.getNode();
          if (i === o && 'text' === n.type && 'text' === r.type) {
            const t = n.offset,
              o = r.offset,
              s = t < o,
              l = s ? t : o,
              c = s ? o : t,
              a = c - 1;
            if (l !== a) {
              (function (t) {
                return !(zo(t) || Pr(t));
              })(i.getTextContent().slice(l, c)) &&
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
      t.isEmpty() && Li(t.getParent()) && null === t.getPreviousSibling() && Ar(this, t);
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
function Er(t) {
  return t instanceof Nr;
}
function Or(t) {
  const e = t.offset;
  if ('text' === t.type) return e;
  const n = t.getNode();
  return e === n.getChildrenSize() ? n.getTextContent().length : 0;
}
function Mr(t) {
  const e = t.getStartEndPoints();
  if (null === e) return [0, 0];
  const [n, r] = e;
  return 'element' === n.type && 'element' === r.type && n.key === r.key && n.offset === r.offset
    ? [0, 0]
    : [Or(n), Or(r)];
}
function Ar(t, e) {
  for (let n = e; n; n = n.getParent()) {
    if (Mi(n)) {
      if (n.collapseAtStart(t)) return !0;
      if (ms(n)) break;
    }
    if (n.getPreviousSibling()) break;
  }
  return !1;
}
const Pr = (() => {
  try {
    const t = new RegExp('\\p{Emoji}', 'u'),
      e = t.test.bind(t);
    if (e('❤️') && e('#️⃣') && e('👍')) return e;
  } catch (t) {}
  return () => !1;
})();
function Dr(t, e, n) {
  const r = t,
    i = r.getTextContent().split(/(?=\s)/g),
    o = i.length;
  let s = 0,
    l = 0;
  for (let t = 0; t < o; t++) {
    const r = t === o - 1;
    if (((l = s), (s += i[t].length), (e && s === n) || s > n || r)) {
      (i.splice(t, 1), r && (l = void 0));
      break;
    }
  }
  const c = i.join('').trim();
  '' === c ? r.remove() : (r.setTextContent(c), r.select(l, l));
}
function Fr(e, n, r, i) {
  let o,
    s = n;
  if (Os(e)) {
    let l = !1;
    const c = e.childNodes,
      a = c.length,
      u = i._blockCursorElement;
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
    if (((o = Ko(f)), pr(o))) s = fl(o, l ? 'next' : 'previous');
    else {
      let c = Ko(e);
      if (null === c) return null;
      if (Mi(c)) {
        const a = i.getElementByKey(c.getKey());
        null === a && t(214);
        const u = c.getDOMSlot(a);
        (([c, s] = u.resolveChildIndex(c, a, e, n)),
          Mi(c) || t(215),
          l && s >= c.getChildrenSize() && (s = Math.max(0, c.getChildrenSize() - 1)));
        let f = c.getChildAtIndex(s);
        if (
          Mi(f) &&
          (function (t, e, n) {
            const r = t.getParent();
            return null === n || null === r || !r.canBeEmpty() || r !== n.getNode();
          })(f, 0, r)
        ) {
          const t = l ? f.getLastDescendant() : f.getFirstDescendant();
          (null === t ? (c = f) : ((f = t), (c = Mi(f) ? f : f.getParentOrThrow())), (s = 0));
        }
        pr(f)
          ? ((o = f), (c = null), (s = fl(f, l ? 'next' : 'previous')))
          : f !== c && l && !d && (Mi(c) || t(216), (s = Math.min(c.getChildrenSize(), s + 1)));
      } else {
        const t = c.getIndexWithinParent();
        ((s = 0 === n && Di(c) && Ko(e) === c ? t : t + 1), (c = c.getParentOrThrow()));
      }
      if (Mi(c)) return vr(c.__key, s, 'element');
    }
  } else o = Ko(e);
  return pr(o) ? vr(o.__key, fl(o, s, 'clamp'), 'text') : null;
}
function Lr(t, e, n) {
  const r = t.offset,
    i = t.getNode();
  if (0 === r) {
    const r = i.getPreviousSibling(),
      o = i.getParent();
    if (e) {
      if ((n || !e) && null === r && Mi(o) && o.isInline()) {
        const e = o.getPreviousSibling();
        pr(e) && t.set(e.__key, e.getTextContent().length, 'text');
      }
    } else
      Mi(r) && !n && r.isInline()
        ? t.set(r.__key, r.getChildrenSize(), 'element')
        : pr(r) && t.set(r.__key, r.getTextContent().length, 'text');
  } else if (r === i.getTextContent().length) {
    const r = i.getNextSibling(),
      o = i.getParent();
    if (e && Mi(r) && r.isInline()) t.set(r.__key, 0, 'element');
    else if ((n || e) && null === r && Mi(o) && o.isInline() && !o.canInsertTextAfter()) {
      const e = o.getNextSibling();
      pr(e) && t.set(e.__key, 0, 'text');
    }
  }
}
function Ir(t, e, n) {
  if ('text' === t.type && 'text' === e.type) {
    const r = t.isBefore(e),
      i = t.is(e);
    (Lr(t, r, i), Lr(e, !r, i), i && e.set(t.key, t.offset, t.type));
    const o = hi();
    if (o.isComposing() && o._compositionKey !== t.key && br(n)) {
      const r = n.anchor,
        i = n.focus;
      (t.set(r.key, r.offset, r.type, !0), e.set(i.key, i.offset, i.type, !0));
    }
  }
}
function Kr(t, e, n, r, i, o) {
  if (null === t || null === n || !uo(i, t, n)) return null;
  const s = Fr(t, e, br(o) ? o.anchor : null, i);
  if (null === s) return null;
  const l = Fr(n, r, br(o) ? o.focus : null, i);
  if (null === l) return null;
  if ('element' === s.type && 'element' === l.type) {
    const e = Ko(t),
      r = Ko(n);
    if (Di(e) && Di(r)) return null;
  }
  return (Ir(s, l, o), [s, l]);
}
function zr(t) {
  return Mi(t) && !t.isInline();
}
function Rr(t, e, n, r, i, o) {
  const s = di(),
    l = new wr(vr(t, e, i), vr(n, r, o), 0, '');
  return ((l.dirty = !0), (s._selection = l), l);
}
function Br() {
  const t = vr('root', 0, 'element'),
    e = vr('root', 0, 'element');
  return new wr(t, e, 0, '');
}
function Wr() {
  return new Nr(new Set());
}
function Jr(t, e) {
  return jr(null, t, e, null);
}
function jr(t, e, n, r) {
  const i = n._window;
  if (null === i) return null;
  const o = r || i.event,
    s = o ? o.type : void 0,
    l = 'selectionchange' === s,
    c =
      !q &&
      (l ||
        'beforeinput' === s ||
        'compositionstart' === s ||
        'compositionend' === s ||
        ('click' === s && o && 3 === o.detail) ||
        'drop' === s ||
        void 0 === s);
  let a, u, f, d;
  if (br(t) && !c) return t.clone();
  if (null === e) return null;
  if (
    ((a = e.anchorNode),
    (u = e.focusNode),
    (f = e.anchorOffset),
    (d = e.focusOffset),
    (l || void 0 === s) && br(t) && !uo(n, a, u))
  )
    return t.clone();
  const h = Kr(a, f, u, d, n, t);
  if (null === h) return null;
  const [g, _] = h;
  return new wr(g, _, br(t) ? t.format : 0, br(t) ? t.style : '');
}
function $r() {
  return di()._selection;
}
function Ur() {
  return hi()._editorState._selection;
}
function Vr(t, e, n, r = 1) {
  const i = t.anchor,
    o = t.focus,
    s = i.getNode(),
    l = o.getNode();
  if (!e.is(s) && !e.is(l)) return;
  const c = e.__key;
  if (t.isCollapsed()) {
    const e = i.offset;
    if ((n <= e && r > 0) || (n < e && r < 0)) {
      const n = Math.max(0, e + r);
      (i.set(c, n, 'element'), o.set(c, n, 'element'), Yr(t));
    }
  } else {
    const s = t.isBackward(),
      l = s ? o : i,
      a = l.getNode(),
      u = s ? i : o,
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
  Yr(t);
}
function Yr(t) {
  const e = t.anchor,
    n = e.offset,
    r = t.focus,
    i = r.offset,
    o = e.getNode(),
    s = r.getNode();
  if (t.isCollapsed()) {
    if (!Mi(o)) return;
    const t = o.getChildrenSize(),
      i = n >= t,
      s = i ? o.getChildAtIndex(t - 1) : o.getChildAtIndex(n);
    if (pr(s)) {
      let t = 0;
      (i && (t = s.getTextContentSize()), e.set(s.__key, t, 'text'), r.set(s.__key, t, 'text'));
    }
    return;
  }
  if (Mi(o)) {
    const t = o.getChildrenSize(),
      r = n >= t,
      i = r ? o.getChildAtIndex(t - 1) : o.getChildAtIndex(n);
    if (pr(i)) {
      let t = 0;
      (r && (t = i.getTextContentSize()), e.set(i.__key, t, 'text'));
    }
  }
  if (Mi(s)) {
    const t = s.getChildrenSize(),
      e = i >= t,
      n = e ? s.getChildAtIndex(t - 1) : s.getChildAtIndex(i);
    if (pr(n)) {
      let t = 0;
      (e && (t = n.getTextContentSize()), r.set(n.__key, t, 'text'));
    }
  }
}
function qr(t, e, n, r, i) {
  let o = null,
    s = 0,
    l = null;
  (null !== r
    ? ((o = r.__key),
      pr(r)
        ? ((s = r.getTextContentSize()), (l = 'text'))
        : Mi(r) && ((s = r.getChildrenSize()), (l = 'element')))
    : null !== i && ((o = i.__key), pr(i) ? (l = 'text') : Mi(i) && (l = 'element')),
    null !== o && null !== l
      ? t.set(o, s, l)
      : ((s = e.getIndexWithinParent()),
        -1 === s && (s = n.getChildrenSize()),
        t.set(n.__key, s, 'element')));
}
function Hr(t, e, n, r, i) {
  'text' === t.type
    ? t.set(n, t.offset + (e ? 0 : i), 'text')
    : t.offset > r.getIndexWithinParent() && t.set(t.key, t.offset - 1, 'element');
}
function Gr(t, e, n, r, i) {
  try {
    t.setBaseAndExtent(e, n, r, i);
  } catch (t) {}
}
function Xr(t, e, n, r, i, o, s) {
  const l = r.anchorNode,
    c = r.focusNode,
    a = r.anchorOffset,
    u = r.focusOffset,
    f = document.activeElement;
  if ((i.has($n) && f !== o) || (null !== f && ao(f))) return;
  if (!br(e)) return void (null !== t && uo(n, l, c) && r.removeAllRanges());
  const d = e.anchor,
    h = e.focus,
    g = d.key,
    _ = h.key,
    p = ls(n, g),
    y = ls(n, _),
    m = d.offset,
    x = h.offset,
    C = e.format,
    S = e.style,
    v = e.isCollapsed();
  let k = p,
    T = y,
    N = !1;
  if ('text' === d.type) {
    k = Co(p);
    const t = d.getNode();
    N = t.getFormat() !== C || t.getStyle() !== S;
  } else br(t) && 'text' === t.anchor.type && (N = !0);
  var b, w, E, O, M;
  if (
    ('text' === h.type && (T = Co(y)), null !== k && null !== T) &&
    (v &&
      (null === t || N || (br(t) && (t.format !== C || t.style !== S))) &&
      ((b = C), (w = S), (E = m), (O = g), (M = performance.now()), (_n = [b, w, E, O, M])),
    a !== m ||
      u !== x ||
      l !== k ||
      c !== T ||
      ('Range' === r.type && v) ||
      ((null !== f && o.contains(f)) || i.has(qn) || o.focus({ preventScroll: !0 }),
      'element' === d.type))
  ) {
    if (
      (Gr(r, k, m, T, x),
      !i.has(Vn) && e.isCollapsed() && null !== o && o === document.activeElement)
    ) {
      const t =
        br(e) && 'element' === e.anchor.type
          ? k.childNodes[m] || null
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
          const r = as(n),
            i = gs(r);
          if (null === r || null === i) return;
          let { top: o, bottom: s } = e,
            l = 0,
            c = 0,
            a = n;
          for (; null !== a; ) {
            const e = a === r.body;
            if (e) ((l = 0), (c = _s(t).innerHeight));
            else {
              const t = a.getBoundingClientRect();
              ((l = t.top), (c = t.bottom));
            }
            let n = 0;
            if ((o < l ? (n = -(l - o)) : s > c && (n = s - c), 0 !== n))
              if (e) i.scrollBy(0, n);
              else {
                const t = a.scrollTop;
                a.scrollTop += n;
                const e = a.scrollTop - t;
                ((o -= e), (s -= e));
              }
            if (e) break;
            a = cs(a);
          }
        })(n, e, o);
      }
    }
    cn = !0;
  }
}
function Qr(t) {
  let e = $r() || Ur();
  (null === e && (e = Fo().selectEnd()), e.insertNodes(t));
}
function Zr() {
  const t = $r();
  return null === t ? '' : t.getTextContent();
}
function ti(e) {
  let n = e;
  e.isCollapsed() || n.removeText();
  const r = $r();
  (br(r) && (n = r), br(n) || t(161));
  const i = n.anchor;
  let o = i.getNode(),
    s = i.offset;
  for (; !Fs(o); ) {
    const t = o;
    if ((([o, s] = ei(o, s)), t.is(o))) break;
  }
  return s;
}
function ei(t, e) {
  const n = t.getParent();
  if (!n) {
    const t = $i();
    return (Fo().append(t), t.select(), [Fo(), 0]);
  }
  if (pr(t)) {
    const r = t.splitText(e);
    if (0 === r.length) return [n, t.getIndexWithinParent()];
    const i = 0 === e ? 0 : 1;
    return [n, r[0].getIndexWithinParent() + i];
  }
  if (!Mi(t) || 0 === e) return [n, t.getIndexWithinParent()];
  const r = t.getChildAtIndex(e);
  if (r) {
    const n = new wr(vr(t.__key, e, 'element'), vr(t.__key, e, 'element'), 0, ''),
      i = t.insertNewAfter(n);
    i && i.append(r, ...r.getNextSiblings());
  }
  return [n, t.getIndexWithinParent() + 1];
}
function ni(t, e, n, r, i = 'decorators-and-blocks') {
  if ('move' === e && 'character' === r && !t.isCollapsed()) {
    const [e, r] = n === t.isBackward() ? [t.focus, t.anchor] : [t.anchor, t.focus];
    return (r.set(e.key, e.offset, e.type), !0);
  }
  const o = El(t.focus, n ? 'previous' : 'next'),
    s = 'lineboundary' === r,
    l = 'move' === e;
  let c = o,
    a = 'decorators-and-blocks' === i;
  if (!zl(c)) {
    for (const t of c) {
      a = !1;
      const { origin: e } = t;
      if (!Di(e) || e.isIsolated() || ((c = t), !s || !e.isInline())) break;
    }
    if (a)
      for (const t of xl(o).iterNodeCarets('extend' === e ? 'shadowRoot' : 'root')) {
        if (ol(t)) t.origin.isInline() || (c = t);
        else {
          if (Mi(t.origin)) continue;
          Di(t.origin) && !t.origin.isInline() && (c = t);
        }
        break;
      }
  }
  if (c === o) return !1;
  if (l && !s && Di(c.origin) && c.origin.isKeyboardSelectable()) {
    const t = Wr();
    return (t.add(c.origin.getKey()), Io(t), !0);
  }
  return ((c = Kl(c)), l && Ol(t.anchor, c), Ol(t.focus, c), a || !s);
}
let ri = null,
  ii = null,
  oi = !1,
  si = !1,
  li = 0;
const ci = { characterData: !0, childList: !0, subtree: !0 };
function ai() {
  return oi || (null !== ri && ri._readOnly);
}
function ui() {
  oi && t(13);
}
function fi() {
  li > 99 && t(14);
}
function di() {
  return (null === ri && t(195, gi()), ri);
}
function hi() {
  return (null === ii && t(196, gi()), ii);
}
function gi() {
  let t = 0;
  const e = new Set(),
    n = to.version;
  if ('undefined' != typeof window)
    for (const r of document.querySelectorAll('[contenteditable]')) {
      const i = go(r);
      if (fo(i)) t++;
      else if (i) {
        let t = String(i.constructor.version || '<0.17.1');
        (t === n && (t += ' (separately built, likely a bundler configuration issue)'), e.add(t));
      }
    }
  let r = ` Detected on the page: ${t} compatible editor(s) with version ${n}`;
  return (
    e.size && (r += ` and incompatible editors with versions ${Array.from(e).join(', ')}`),
    r
  );
}
function _i() {
  return ii;
}
function pi(t, e, n) {
  const r = e.__type,
    i = oo(t, r);
  let o = n.get(r);
  void 0 === o && ((o = Array.from(i.transforms)), n.set(r, o));
  const s = o.length;
  for (let t = 0; t < s && (o[t](e), e.isAttached()); t++);
}
function yi(t, e) {
  return void 0 !== t && t.__key !== e && t.isAttached();
}
function mi(t, e) {
  if (!e) return;
  const n = t._updateTags;
  let r = e;
  Array.isArray(e) || (r = [e]);
  for (const t of r) n.add(t);
}
function xi(t) {
  return Ci(t, hi()._nodes);
}
function Ci(e, n) {
  const r = e.type,
    i = n.get(r);
  void 0 === i && t(17, r);
  const o = i.klass;
  e.type !== o.getType() && t(18, o.name);
  const s = o.importJSON(e),
    l = e.children;
  if (Mi(s) && Array.isArray(l))
    for (let t = 0; t < l.length; t++) {
      const e = Ci(l[t], n);
      s.append(e);
    }
  return s;
}
function Si(t, e, n) {
  const r = ri,
    i = oi,
    o = ii;
  ((ri = e), (oi = !0), (ii = t));
  try {
    return n();
  } finally {
    ((ri = r), (oi = i), (ii = o));
  }
}
function vi(t, e) {
  const n = t._pendingEditorState,
    r = t._rootElement,
    i = t._headless || null === r;
  if (null === n) return;
  const o = t._editorState,
    s = o._selection,
    l = n._selection,
    c = 0 !== t._dirtyType,
    a = ri,
    u = oi,
    f = ii,
    d = t._updating,
    g = t._observer;
  let _ = null;
  if (((t._pendingEditorState = null), (t._editorState = n), !i && c && null !== g)) {
    ((ii = t), (ri = n), (oi = !1), (t._updating = !0));
    try {
      const e = t._dirtyType,
        r = t._dirtyElements,
        i = t._dirtyLeaves;
      (g.disconnect(), (_ = ee(o, n, t, e, r, i)));
    } catch (e) {
      if ((e instanceof Error && t._onError(e), si)) throw e;
      return (Xi(t, null, r, n), rt(t), (t._dirtyType = 2), (si = !0), vi(t, o), void (si = !1));
    } finally {
      (g.observe(r, ci), (t._updating = d), (ri = a), (oi = u), (ii = f));
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
      const i = e._nodeMap;
      let o;
      for (o in r) i.has(o) || (r === n && (r = Po(t)), delete r[o]);
    })(t, n));
  const S = i ? null : Ns(_s(t));
  if (
    t._editable &&
    null !== S &&
    (c || null === l || l.dirty || !l.is(s)) &&
    null !== r &&
    !x.has(Yn)
  ) {
    ((ii = t), (ri = n));
    try {
      if ((null !== g && g.disconnect(), c || null === l || l.dirty)) {
        const e = t._blockCursorElement;
        (null !== e && Ts(e, t, r), Xr(s, l, t, S, x, r));
      }
      !(function (t, e, n) {
        let r = t._blockCursorElement;
        if (
          br(n) &&
          n.isCollapsed() &&
          'element' === n.anchor.type &&
          e.contains(document.activeElement)
        ) {
          const i = n.anchor,
            o = i.getNode(),
            s = i.offset;
          let l = !1,
            c = null;
          if (s === o.getChildrenSize()) {
            ks(o.getChildAtIndex(s - 1)) && (l = !0);
          } else {
            const e = o.getChildAtIndex(s);
            if (null !== e && ks(e)) {
              const n = e.getPreviousSibling();
              (null === n || ks(n)) && ((l = !0), (c = t.getElementByKey(e.__key)));
            }
          }
          if (l) {
            const n = t.getElementByKey(o.__key);
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
        null !== r && Ts(r, t, e);
      })(t, r, l);
    } finally {
      (null !== g && g.observe(r, ci), (ii = f), (ri = a));
    }
  }
  (null !== _ &&
    (function (t, e, n, r, i) {
      const o = Array.from(t._listeners.mutation),
        s = o.length;
      for (let t = 0; t < s; t++) {
        const [s, l] = o[t];
        for (const t of l) {
          const o = e.get(t);
          void 0 !== o && s(o, { dirtyLeaves: r, prevEditorState: i, updateTags: n });
        }
      }
    })(t, _, x, p, o),
    br(l) || null === l || (null !== s && s.is(l)) || t.dispatchCommand(ie, void 0));
  const v = t._pendingDecorators;
  (null !== v && ((t._decorators = v), (t._pendingDecorators = null), ki('decorator', t, !0, v)),
    (function (t, e, n) {
      const r = Do(e),
        i = Do(n);
      r !== i && ki('textcontent', t, !0, i);
    })(t, e || o, n),
    ki('update', t, !0, {
      dirtyElements: y,
      dirtyLeaves: p,
      editorState: n,
      mutatedNodes: _,
      normalizedNodes: m,
      prevEditorState: e || o,
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
          Ni(t, e, r);
        }
      }
    })(t));
}
function ki(t, e, n, ...r) {
  const i = e._updating;
  e._updating = n;
  try {
    const n = Array.from(e._listeners[t]);
    for (let t = 0; t < n.length; t++) n[t].apply(null, r);
  } finally {
    e._updating = i;
  }
}
function Ti(e, n) {
  const r = e._updates;
  let i = n || !1;
  for (; 0 !== r.length; ) {
    const n = r.shift();
    if (n) {
      const [r, o] = n,
        s = e._pendingEditorState;
      let l;
      (void 0 !== o &&
        ((l = o.onUpdate),
        o.skipTransforms && (i = !0),
        o.discrete && (null === s && t(191), (s._flushSync = !0)),
        l && e._deferred.push(l),
        mi(e, o.tag)),
        null == s ? Ni(e, r, o) : r());
    }
  }
  return i;
}
function Ni(e, n, r) {
  const i = e._updateTags;
  let o,
    s = !1,
    l = !1;
  (void 0 !== r &&
    ((o = r.onUpdate), mi(e, r.tag), (s = r.skipTransforms || !1), (l = r.discrete || !1)),
    o && e._deferred.push(o));
  const c = e._editorState;
  let a = e._pendingEditorState,
    u = !1;
  ((null === a || a._readOnly) && ((a = e._pendingEditorState = Ii(a || c)), (u = !0)),
    (a._flushSync = l));
  const f = ri,
    d = oi,
    h = ii,
    g = e._updating;
  ((ri = a), (oi = !1), (e._updating = !0), (ii = e));
  const _ = e._headless || null === e.getRootElement();
  no(null);
  try {
    u &&
      (_
        ? null !== c._selection && (a._selection = c._selection.clone())
        : (a._selection = (function (t, e) {
            const n = t.getEditorState()._selection,
              r = Ns(_s(t));
            return br(n) || null == n ? jr(n, r, t, e) : n.clone();
          })(e, (r && r.event) || null)));
    const i = e._compositionKey;
    (n(),
      (s = Ti(e, s)),
      (function (t, e) {
        const n = e.getEditorState()._selection,
          r = t._selection;
        if (br(r)) {
          const t = r.anchor,
            e = r.focus;
          let i;
          if (
            ('text' === t.type && ((i = t.getNode()), i.selectionTransform(n, r)),
            'text' === e.type)
          ) {
            const t = e.getNode();
            i !== t && t.selectionTransform(n, r);
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
                pr(e) && e.isAttached() && e.isSimpleText() && !e.isUnmergeable() && Ct(e);
              }
            })(a, e)
          : (function (t, e) {
              const n = e._dirtyLeaves,
                r = e._dirtyElements,
                i = t._nodeMap,
                o = wo(),
                s = new Map();
              let l = n,
                c = l.size,
                a = r,
                u = a.size;
              for (; c > 0 || u > 0; ) {
                if (c > 0) {
                  e._dirtyLeaves = new Set();
                  for (const t of l) {
                    const r = i.get(t);
                    (pr(r) && r.isAttached() && r.isSimpleText() && !r.isUnmergeable() && Ct(r),
                      void 0 !== r && yi(r, o) && pi(e, r, s),
                      n.add(t));
                  }
                  if (((l = e._dirtyLeaves), (c = l.size), c > 0)) {
                    li++;
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
                  const c = i.get(n);
                  void 0 !== c && yi(c, o) && pi(e, c, s);
                }
                ((l = e._dirtyLeaves), (c = l.size), (a = e._dirtyElements), (u = a.size), li++);
              }
              ((e._dirtyLeaves = n), (e._dirtyElements = r));
            })(a, e),
        Ti(e),
        (function (t, e, n, r) {
          const i = t._nodeMap,
            o = e._nodeMap,
            s = [];
          for (const [t] of r) {
            const e = o.get(t);
            void 0 !== e &&
              (e.isAttached() ||
                (Mi(e) && Y(e, t, i, o, s, r), i.has(t) || r.delete(t), s.push(t)));
          }
          for (const t of s) o.delete(t);
          for (const t of n) {
            const e = o.get(t);
            void 0 === e || e.isAttached() || (i.has(t) || n.delete(t), o.delete(t));
          }
        })(c, a, e._dirtyLeaves, e._dirtyElements)));
    i !== e._compositionKey && (a._flushSync = !0);
    const o = a._selection;
    if (br(o)) {
      const e = a._nodeMap,
        n = o.anchor.key,
        r = o.focus.key;
      (void 0 !== e.get(n) && void 0 !== e.get(r)) || t(19);
    } else Er(o) && 0 === o._nodes.size && (a._selection = null);
  } catch (t) {
    return (
      t instanceof Error && e._onError(t),
      (e._pendingEditorState = c),
      (e._dirtyType = 2),
      e._cloneNotNeeded.clear(),
      (e._dirtyLeaves = new Set()),
      e._dirtyElements.clear(),
      void vi(e)
    );
  } finally {
    ((ri = f), (oi = d), (ii = h), (e._updating = g), (li = 0));
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
      ? ((a._flushSync = !1), vi(e))
      : u &&
        lo(() => {
          vi(e);
        })
    : ((a._flushSync = !1), u && (i.clear(), (e._deferred = []), (e._pendingEditorState = null)));
}
function bi(t, e, n) {
  ii === t && void 0 === n ? e() : Ni(t, e, n);
}
class wi {
  element;
  before;
  after;
  constructor(t, e, n) {
    ((this.element = t), (this.before = e || null), (this.after = n || null));
  }
  withBefore(t) {
    return new wi(this.element, t, this.after);
  }
  withAfter(t) {
    return new wi(this.element, this.before, t);
  }
  withElement(t) {
    return this.element === t ? this : new wi(t, this.before, this.after);
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
      i = document.createElement('br');
    if ((n.insertBefore(i, r), t)) {
      const t = document.createElement('img');
      (t.setAttribute('data-lexical-linebreak', 'true'),
        (t.style.cssText =
          'display: inline !important; border: 0px !important; margin: 0px !important;'),
        (t.alt = ''),
        n.insertBefore(t, i),
        (n.__lexicalLineBreak = t));
    } else n.__lexicalLineBreak = i;
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
    const i = Ei(e, n);
    i.push(r);
    const o = Ei(e, this.element);
    let s = t.getIndexWithinParent();
    for (let t = 0; t < o.length; t++) {
      const e = i[t],
        n = o[t];
      if (void 0 === e || e < n) break;
      if (e > n) {
        s += 1;
        break;
      }
    }
    return [t.getParentOrThrow(), s];
  }
}
function Ei(e, n) {
  const r = [];
  let i = n;
  for (; i !== e && null !== i; i = i.parentNode) {
    let t = 0;
    for (let e = i.previousSibling; null !== e; e = e.previousSibling) t++;
    r.push(t);
  }
  return (i !== e && t(225), r.reverse());
}
class Oi extends Rn {
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
    return J[t] || '';
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
    const t = hi()._dirtyElements;
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
      if ((pr(e) && t.push(e), Mi(e))) {
        const n = e.getAllTextNodes();
        t.push(...n);
      }
      e = e.getNextSibling();
    }
    return t;
  }
  getFirstDescendant() {
    let t = this.getFirstChild();
    for (; Mi(t); ) {
      const e = t.getFirstChild();
      if (null === e) break;
      t = e;
    }
    return t;
  }
  getLastDescendant() {
    let t = this.getLastChild();
    for (; Mi(t); ) {
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
      return (Mi(t) && t.getLastDescendant()) || t || null;
    }
    const r = e[t];
    return (Mi(r) && r.getFirstDescendant()) || r || null;
  }
  getFirstChild() {
    const t = this.getLatest().__first;
    return null === t ? null : Eo(t);
  }
  getFirstChildOrThrow() {
    const e = this.getFirstChild();
    return (null === e && t(45, this.__key), e);
  }
  getLastChild() {
    const t = this.getLatest().__last;
    return null === t ? null : Eo(t);
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
      const i = e[r];
      ((t += i.getTextContent()), Mi(i) && r !== n - 1 && !i.isInline() && (t += D));
    }
    return t;
  }
  getTextContentSize() {
    let t = 0;
    const e = this.getChildren(),
      n = e.length;
    for (let r = 0; r < n; r++) {
      const i = e[r];
      ((t += i.getTextContentSize()), Mi(i) && r !== n - 1 && !i.isInline() && (t += 2));
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
      const e = W[t];
      return 0 !== (this.getFormat() & e);
    }
    return !1;
  }
  hasTextFormat(t) {
    const e = R[t];
    return 0 !== (this.getTextFormat() & e);
  }
  getFormatFlags(t, e) {
    return So(this.getLatest().__textFormat, t, e);
  }
  getTextStyle() {
    return this.getLatest().__textStyle;
  }
  select(t, e) {
    ui();
    const n = $r();
    let r = t,
      i = e;
    const o = this.getChildrenSize();
    if (!this.canBeEmpty())
      if (0 === t && 0 === e) {
        const t = this.getFirstChild();
        if (pr(t) || Mi(t)) return t.select(0, 0);
      } else if (!((void 0 !== t && t !== o) || (void 0 !== e && e !== o))) {
        const t = this.getLastChild();
        if (pr(t) || Mi(t)) return t.select();
      }
    (void 0 === r && (r = o), void 0 === i && (i = o));
    const s = this.__key;
    return br(n)
      ? (n.anchor.set(s, r, 'element'), n.focus.set(s, i, 'element'), (n.dirty = !0), n)
      : Rr(s, r, s, i, 'element', 'element');
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
    return ((this.getWritable().__format = '' !== t ? W[t] : 0), this);
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
    zn(this) && t(324, this.__key, this.__type);
    const i = this.getChildrenSize(),
      o = this.getWritable();
    e + n <= i || t(226, String(e), String(n), String(i));
    const s = o.__key,
      l = [],
      c = [],
      a = this.getChildAtIndex(e + n);
    let u = null,
      f = i - n + r.length;
    if (0 !== e)
      if (e === i) u = this.getLastChild();
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
        (To(e.getWritable()), c.push(r), (e = n));
      }
    }
    let d = u;
    for (const e of r) {
      null !== d && e.is(d) && (u = d = d.getPreviousSibling());
      const n = e.getWritable();
      (n.__parent === s && f--, To(n));
      const r = e.__key;
      if (null === d) ((o.__first = r), (n.__prev = null));
      else {
        const t = d.getWritable();
        ((t.__next = r), (n.__prev = t.__key));
      }
      (e.__key === s && t(76), (n.__parent = s), l.push(r), (d = e));
    }
    if (e + n === i) {
      if (null !== d) {
        ((d.getWritable().__next = null), (o.__last = d.__key));
      }
    } else if (null !== a) {
      const t = a.getWritable();
      if (null !== d) {
        const e = d.getWritable();
        ((t.__prev = d.__key), (e.__next = a.__key));
      } else t.__prev = null;
    }
    if (((o.__size = f), c.length)) {
      const t = $r();
      if (br(t)) {
        const e = new Set(c),
          n = new Set(l),
          { anchor: r, focus: i } = t;
        (Ai(r, e, n) && qr(r, r.getNode(), this, u, a),
          Ai(i, e, n) && qr(i, i.getNode(), this, u, a),
          0 !== f || this.canBeEmpty() || ms(this) || this.remove());
      }
    }
    return o;
  }
  getDOMSlot(t) {
    return new wi(t);
  }
  exportDOM(t) {
    const { element: e } = super.exportDOM(t);
    if (Os(e)) {
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
        ms(this) ||
        this.getChildren().some(pr) ||
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
      const i = e.getElementByKey(t.getKey());
      null !== i &&
        (null == r ? (n.insertChild(i), (r = i)) : r !== i && n.replaceChild(i, r),
        (r = r.nextSibling));
    }
  }
}
function Mi(t) {
  return t instanceof Oi;
}
function Ai(t, e, n) {
  let r = t.getNode();
  for (; r; ) {
    const t = r.__key;
    if (e.has(t) && !n.has(t)) return !0;
    r = r.getParent();
  }
  return !1;
}
class Pi extends Rn {
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
function Di(t) {
  return t instanceof Pi;
}
class Fi extends Oi {
  __cachedText;
  static getType() {
    return 'root';
  }
  static clone() {
    return new Fi();
  }
  constructor() {
    (super('root'), (this.__cachedText = null));
  }
  getTopLevelElementOrThrow() {
    t(51);
  }
  getTextContent() {
    const t = this.__cachedText;
    return (!ai() && 0 !== hi()._dirtyType) || null === t ? super.getTextContent() : t;
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
    for (const e of r) Mi(e) || Di(e) || t(282);
    return super.splice(e, n, r);
  }
  static importJSON(t) {
    return Fo().updateFromJSON(t);
  }
  collapseAtStart() {
    return !0;
  }
}
function Li(t) {
  return t instanceof Fi;
}
function Ii(t) {
  return new Bi(new Map(t._nodeMap));
}
function Ki() {
  return new Bi(new Map([['root', new Fi()]]));
}
function zi(e) {
  const n = e.exportJSON(),
    r = e.constructor;
  if ((n.type !== r.getType() && t(130, r.name), Mi(e))) {
    const i = n.children;
    Array.isArray(i) || t(59, r.name);
    const o = e.getChildren();
    for (let t = 0; t < o.length; t++) {
      const e = zi(o[t]);
      i.push(e);
    }
  }
  return n;
}
function Ri(t) {
  return t instanceof Bi;
}
class Bi {
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
    return Si((e && e.editor) || null, this, t);
  }
  clone(t) {
    const e = new Bi(this._nodeMap, void 0 === t ? this._selection : t);
    return ((e._readOnly = !0), e);
  }
  toJSON() {
    return Si(null, this, () => ({ root: zi(Fo()) }));
  }
}
class Wi extends Oi {
  static getType() {
    return 'artificial';
  }
  createDOM(t) {
    return document.createElement('div');
  }
}
class Ji extends Oi {
  static getType() {
    return 'paragraph';
  }
  static clone(t) {
    return new Ji(t.__key);
  }
  createDOM(t) {
    const e = document.createElement('p'),
      n = Zo(t.theme, 'paragraph');
    if (void 0 !== n) {
      e.classList.add(...n);
    }
    return e;
  }
  updateDOM(t, e, n) {
    return !1;
  }
  static importDOM() {
    return { p: (t) => ({ conversion: ji, priority: 0 }) };
  }
  exportDOM(t) {
    const { element: e } = super.exportDOM(t);
    if (Os(e)) {
      this.isEmpty() && e.append(document.createElement('br'));
      const t = this.getFormatType();
      t && (e.style.textAlign = t);
    }
    return { element: e };
  }
  static importJSON(t) {
    return $i().updateFromJSON(t);
  }
  exportJSON() {
    const t = super.exportJSON();
    if (void 0 === t.textFormat || void 0 === t.textStyle) {
      const e = this.getChildren().find(pr);
      e
        ? ((t.textFormat = e.getFormat()), (t.textStyle = e.getStyle()))
        : ((t.textFormat = this.getTextFormat()), (t.textStyle = this.getTextStyle()));
    }
    return t;
  }
  insertNewAfter(t, e) {
    const n = $i();
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
    if (0 === t.length || (pr(t[0]) && '' === t[0].getTextContent().trim())) {
      if (null !== this.getNextSibling()) return (this.selectNext(), this.remove(), !0);
      if (null !== this.getPreviousSibling()) return (this.selectPrevious(), this.remove(), !0);
    }
    return !1;
  }
}
function ji(t) {
  const e = $i();
  return (t.style && (e.setFormat(t.style.textAlign), Ws(t, e)), { node: e });
}
function $i() {
  return Cs(new Ji());
}
function Ui(t) {
  return t instanceof Ji;
}
const Vi = 0,
  Yi = 1,
  qi = 2,
  Hi = 3,
  Gi = 4;
function Xi(t, e, n, r) {
  const i = t._keyToDOMMap;
  (i.clear(),
    (t._editorState = Ki()),
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
  const o = t._observer;
  (null !== o && (o.disconnect(), (t._observer = null)),
    null !== e && (e.textContent = ''),
    null !== n && ((n.textContent = ''), i.set('root', n)));
}
function Qi(t) {
  const e = new Set(),
    n = new Set();
  let r = t;
  for (; r; ) {
    const { ownNodeConfig: t } = Us(r),
      i = r.transform;
    if (!n.has(i)) {
      n.add(i);
      const t = r.transform();
      t && e.add(t);
    }
    if (t) {
      const n = t.$transform;
      (n && e.add(n), (r = t.extends));
    } else {
      const t = Object.getPrototypeOf(r);
      r = t.prototype instanceof Rn && t !== Rn ? t : void 0;
    }
  }
  return e;
}
function Zi(t) {
  const e = t || {},
    n = _i(),
    r = e.theme || {},
    i = void 0 === t ? n : e.parentEditor || null,
    o = e.disableEvents || !1,
    s = Ki(),
    l = e.namespace || (null !== i ? i._config.namespace : Bo()),
    c = e.editorState,
    a = [Fi, sr, Hn, mr, Ji, Wi, ...(e.nodes || [])],
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
      Us(e);
      const i = e.getType(),
        o = Qi(e);
      h.set(i, {
        exportDOM: f && f.export ? f.export.get(e) : void 0,
        klass: e,
        replace: n,
        replaceWithKlass: r,
        sharedNodeState: at(a[t]),
        transforms: o,
      });
    }
  }
  const g = new to(
    s,
    i,
    h,
    { disableEvents: o, namespace: l, theme: r },
    u || console.error,
    (function (t, e) {
      const n = new Map(),
        r = new Set(),
        i = (t) => {
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
          null !== n && i(n);
        }),
        e && i(e),
        n
      );
    })(h, f ? f.import : void 0),
    d,
    t,
  );
  return (
    void 0 !== c && ((g._pendingEditorState = c), (g._dirtyType = 2)),
    (function (t) {
      (t.registerCommand(le, vn, Vi),
        t.registerCommand(ce, kn, Vi),
        t.registerCommand(ae, Tn, Vi),
        t.registerCommand(ue, Nn, Vi),
        t.registerCommand(ve, wn, Vi));
    })(g),
    g
  );
}
class to {
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
  constructor(t, e, n, r, i, o, s, l) {
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
      (this._key = Bo()),
      (this._onError = i),
      (this._htmlConversions = o),
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
    const i = this._commands;
    i.has(e) || i.set(e, [new Set(), new Set(), new Set(), new Set(), new Set()]);
    const o = i.get(e);
    void 0 === o && t(36, String(e));
    const s = o[r];
    return (
      s.add(n),
      () => {
        (s.delete(n), o.every((t) => 0 === t.size) && i.delete(e));
      }
    );
  }
  registerMutationListener(t, e, n) {
    const r = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t)).klass,
      i = this._listeners.mutation;
    let o = i.get(e);
    (void 0 === o && ((o = new Set()), i.set(e, o)), o.add(r));
    const s = n && n.skipInitialization;
    return (
      (void 0 !== s && s) || this.initializeMutationListener(e, r),
      () => {
        (o.delete(r), 0 === o.size && i.delete(e));
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
      r = zs(n).get(e.getType());
    if (!r) return;
    const i = new Map();
    for (const t of r.keys()) i.set(t, 'created');
    i.size > 0 &&
      t(i, {
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
      i = n.replaceWithKlass;
    if (null != i) {
      const t = this.registerNodeTransformToKlass(i, e);
      r.push(t);
    }
    return (
      (function (t, e) {
        const n = zs(t.getEditorState()),
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
                const t = Eo(e);
                t && t.markDirty();
              }
          },
          null === t._pendingEditorState ? { tag: Jn } : void 0,
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
    return os(this, t, e);
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
      const n = Zo(this._config.theme, 'root'),
        r = this._pendingEditorState || this._editorState;
      if (
        ((this._rootElement = t),
        Xi(this, e, t, r),
        null !== e && (this._config.disableEvents || Fn(e), null != n && e.classList.remove(...n)),
        null !== t)
      ) {
        const e = gs(t),
          r = t.style;
        ((r.userSelect = 'text'),
          (r.whiteSpace = 'pre-wrap'),
          (r.wordBreak = 'break-word'),
          t.setAttribute('data-lexical-editor', 'true'),
          (this._window = e),
          (this._dirtyType = 2),
          rt(this),
          this._updateTags.add(Jn),
          vi(this),
          this._config.disableEvents ||
            (function (t, e) {
              const n = t.ownerDocument;
              sn.set(t, n);
              const r = ln.get(n) ?? 0;
              (r < 1 && n.addEventListener('selectionchange', Mn),
                ln.set(n, r + 1),
                (t.__lexicalEditor = e));
              const i = En(t);
              for (let n = 0; n < tn.length; n++) {
                const [r, o] = tn[n],
                  s =
                    'function' == typeof o
                      ? (t) => {
                          Pn(t) || (An(t), (e.isEditable() || 'click' === r) && o(t, e));
                        }
                      : (t) => {
                          if (Pn(t)) return;
                          An(t);
                          const n = e.isEditable();
                          switch (r) {
                            case 'cut':
                              return n && os(e, $e, t);
                            case 'copy':
                              return os(e, je, t);
                            case 'paste':
                              return n && os(e, _e, t);
                            case 'dragstart':
                              return n && os(e, Be, t);
                            case 'dragover':
                              return n && os(e, We, t);
                            case 'dragend':
                              return n && os(e, Je, t);
                            case 'focus':
                              return n && os(e, Ge, t);
                            case 'blur':
                              return n && os(e, Xe, t);
                            case 'drop':
                              return n && os(e, ze, t);
                          }
                        };
                (t.addEventListener(r, s),
                  i.push(() => {
                    t.removeEventListener(r, s);
                  }));
              }
            })(t, this),
          null != n && t.classList.add(...n));
      } else ((this._window = null), this._updateTags.add(Jn), vi(this));
      ki('root', this, !1, t, e);
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
    (r._readOnly && ((r = Ii(e)), (r._selection = e._selection ? e._selection.clone() : null)),
      nt(this));
    const i = this._pendingEditorState,
      o = this._updateTags,
      s = void 0 !== n ? n.tag : null;
    (null === i || i.isEmpty() || (null != s && o.add(s), vi(this)),
      (this._pendingEditorState = r),
      (this._dirtyType = 2),
      this._dirtyElements.set('root', !1),
      (this._compositionKey = null),
      null != s && o.add(s),
      this._updating || vi(this));
  }
  parseEditorState(t, e) {
    return (function (t, e, n) {
      const r = Ki(),
        i = ri,
        o = oi,
        s = ii,
        l = e._dirtyElements,
        c = e._dirtyLeaves,
        a = e._cloneNotNeeded,
        u = e._dirtyType;
      ((e._dirtyElements = new Map()),
        (e._dirtyLeaves = new Set()),
        (e._cloneNotNeeded = new Set()),
        (e._dirtyType = 0),
        (ri = r),
        (oi = !1),
        (ii = e),
        no(null));
      try {
        const i = e._nodes;
        (Ci(t.root, i), n && n(r), (r._readOnly = !0));
      } catch (t) {
        t instanceof Error && e._onError(t);
      } finally {
        ((e._dirtyElements = l),
          (e._dirtyLeaves = c),
          (e._cloneNotNeeded = a),
          (e._dirtyType = u),
          (ri = i),
          (oi = o),
          (ii = s));
      }
      return r;
    })('string' == typeof t ? JSON.parse(t) : t, this, e);
  }
  read(t) {
    return (vi(this), this.getEditorState().read(t, { editor: this }));
  }
  update(t, e) {
    !(function (t, e, n) {
      t._updating ? t._updates.push([e, n]) : Ni(t, e, n);
    })(this, t, e);
  }
  focus(t, e = {}) {
    const n = this._rootElement;
    null !== n &&
      (n.setAttribute('autocapitalize', 'off'),
      bi(this, () => {
        const r = $r(),
          i = Fo();
        (null !== r
          ? r.dirty || Io(r.clone())
          : 0 !== i.getChildrenSize() &&
            ('rootStart' === e.defaultSelection ? i.selectStart() : i.selectEnd()),
          fs('focus'),
          ds(() => {
            (n.removeAttribute('autocapitalize'), t && t());
          }));
      }),
      null === this._pendingEditorState && n.removeAttribute('autocapitalize'));
  }
  blur() {
    const t = this._rootElement;
    null !== t && t.blur();
    const e = Ns(this._window);
    null !== e && e.removeAllRanges();
  }
  isEditable() {
    return this._editable;
  }
  setEditable(t) {
    this._editable !== t && ((this._editable = t), ki('editable', this, !0, t));
  }
  toJSON() {
    return { editorState: this._editorState.toJSON() };
  }
}
to.version = '0.39.0+prod.esm';
let eo = null;
function no(t) {
  eo = t;
}
let ro = 1;
function io() {
  ro = 1;
}
function oo(e, n) {
  const r = so(e, n);
  return (void 0 === r && t(30, n), r);
}
function so(t, e) {
  return t._nodes.get(e);
}
const lo =
  'function' == typeof queueMicrotask
    ? queueMicrotask
    : (t) => {
        Promise.resolve().then(t);
      };
function co(t) {
  return Di(Ao(t));
}
function ao(t) {
  const e = document.activeElement;
  if (!Os(e)) return !1;
  const n = e.nodeName;
  return (
    Di(Ao(t)) &&
    ('INPUT' === n || 'TEXTAREA' === n || ('true' === e.contentEditable && null == go(e)))
  );
}
function uo(t, e, n) {
  const r = t.getRootElement();
  try {
    return null !== r && r.contains(e) && r.contains(n) && null !== e && !ao(e) && ho(e) === t;
  } catch (t) {
    return !1;
  }
}
function fo(t) {
  return t instanceof to;
}
function ho(t) {
  let e = t;
  for (; null != e; ) {
    const t = go(e);
    if (fo(t)) return t;
    e = cs(e);
  }
  return null;
}
function go(t) {
  return t ? t.__lexicalEditor : null;
}
function _o(t) {
  return K.test(t) ? 'rtl' : z.test(t) ? 'ltr' : null;
}
function po(t) {
  return Cr(t) || t.isToken();
}
function yo(t) {
  return po(t) || t.isSegmented();
}
function mo(t) {
  return Ms(t) && 3 === t.nodeType;
}
function xo(t) {
  return Ms(t) && 9 === t.nodeType;
}
function Co(t) {
  let e = t;
  for (; null != e; ) {
    if (mo(e)) return e;
    e = e.firstChild;
  }
  return null;
}
function So(t, e, n) {
  const r = R[e];
  if (null !== n && (t & r) === (n & r)) return t;
  let i = t ^ r;
  return (
    'subscript' === e
      ? (i &= ~R.superscript)
      : 'superscript' === e
        ? (i &= ~R.subscript)
        : 'lowercase' === e
          ? ((i &= ~R.uppercase), (i &= ~R.capitalize))
          : 'uppercase' === e
            ? ((i &= ~R.lowercase), (i &= ~R.capitalize))
            : 'capitalize' === e && ((i &= ~R.lowercase), (i &= ~R.uppercase)),
    i
  );
}
function vo(t) {
  return pr(t) || Qn(t) || Di(t);
}
function ko(t, e) {
  const n = (function () {
    const t = eo;
    return ((eo = null), t);
  })();
  if (null != (e = e || (n && n.__key))) return void (t.__key = e);
  (ui(), fi());
  const r = hi(),
    i = di(),
    o = '' + ro++;
  (i._nodeMap.set(o, t),
    Mi(t) ? r._dirtyElements.set(o, !0) : r._dirtyLeaves.add(o),
    r._cloneNotNeeded.add(o),
    (r._dirtyType = 1),
    (t.__key = o));
}
function To(t) {
  const e = t.getParent();
  if (null !== e) {
    const n = t.getWritable(),
      r = e.getWritable(),
      i = t.getPreviousSibling(),
      o = t.getNextSibling(),
      s = null !== o ? o.__key : null,
      l = null !== i ? i.__key : null,
      c = null !== i ? i.getWritable() : null,
      a = null !== o ? o.getWritable() : null;
    (null === i && (r.__first = s),
      null === o && (r.__last = l),
      null !== c && (c.__next = s),
      null !== a && (a.__prev = l),
      (n.__prev = null),
      (n.__next = null),
      (n.__parent = null),
      r.__size--);
  }
}
function No(e) {
  (fi(), zn(e) && t(323, e.__key, e.__type));
  const n = e.getLatest(),
    r = n.__parent,
    i = di(),
    o = hi(),
    s = i._nodeMap,
    l = o._dirtyElements;
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
  ((o._dirtyType = 1), Mi(e) ? l.set(c, !0) : o._dirtyLeaves.add(c));
}
function bo(t) {
  ui();
  const e = hi(),
    n = e._compositionKey;
  if (t !== n) {
    if (((e._compositionKey = t), null !== n)) {
      const t = Eo(n);
      null !== t && t.getWritable();
    }
    if (null !== t) {
      const e = Eo(t);
      null !== e && e.getWritable();
    }
  }
}
function wo() {
  if (ai()) return null;
  return hi()._compositionKey;
}
function Eo(t, e) {
  const n = (e || di())._nodeMap.get(t);
  return void 0 === n ? null : n;
}
function Oo(t, e) {
  const n = Mo(t, hi());
  return void 0 !== n ? Eo(n, e) : null;
}
function Mo(t, e) {
  return t[`__lexicalKey_${e._key}`];
}
function Ao(t, e) {
  let n = t;
  for (; null != n; ) {
    const t = Oo(n, e);
    if (null !== t) return t;
    n = cs(n);
  }
  return null;
}
function Po(t) {
  const e = t._decorators,
    n = Object.assign({}, e);
  return ((t._pendingDecorators = n), n);
}
function Do(t) {
  return t.read(() => Fo().getTextContent());
}
function Fo() {
  return Lo(di());
}
function Lo(t) {
  return t._nodeMap.get('root');
}
function Io(t) {
  ui();
  const e = di();
  (null !== t && ((t.dirty = !0), t.setCachedNodes(null)), (e._selection = t));
}
function Ko(t) {
  const e = hi(),
    n = (function (t, e) {
      let n = t;
      for (; null != n; ) {
        const t = Mo(n, e);
        if (void 0 !== t) return t;
        n = cs(n);
      }
      return null;
    })(t, e);
  if (null === n) {
    return t === e.getRootElement() ? Eo('root') : null;
  }
  return Eo(n);
}
function zo(t) {
  return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t);
}
function Ro(t) {
  const e = [];
  let n = t;
  for (; null !== n; ) (e.push(n), (n = n._parentEditor));
  return e;
}
function Bo() {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substring(0, 5);
}
function Wo(t) {
  return mo(t) ? t.nodeValue : null;
}
function Jo(t, e, n) {
  const r = Ns(_s(e));
  if (null === r) return;
  const i = r.anchorNode;
  let { anchorOffset: o, focusOffset: s } = r;
  if (null !== i) {
    let e = Wo(i);
    const r = Ao(i);
    if (null !== e && pr(r)) {
      if (e === P && n) {
        const t = n.length;
        ((e = n), (o = t), (s = t));
      }
      null !== e && jo(r, e, o, s, t);
    }
  }
}
function jo(t, e, n, r, i) {
  let o = t;
  if (o.isAttached() && (i || !o.isDirty())) {
    const s = o.isComposing();
    let a = e;
    (s || i) && e[e.length - 1] === P && (a = e.slice(0, -1));
    const u = o.getTextContent();
    if (i || a !== u) {
      if ('' === a) {
        if ((bo(null), l || c || d)) o.remove();
        else {
          const t = hi();
          setTimeout(() => {
            t.update(() => {
              o.isAttached() && o.remove();
            });
          }, 20);
        }
        return;
      }
      const e = o.getParent(),
        i = Ur(),
        u = o.getTextContentSize(),
        f = wo(),
        h = o.getKey();
      if (
        o.isToken() ||
        (null !== f && h === f && !s) ||
        (br(i) &&
          ((null !== e && !e.canInsertTextBefore() && 0 === i.anchor.offset) ||
            (i.anchor.key === t.__key && 0 === i.anchor.offset && !o.canInsertTextBefore() && !s) ||
            (i.focus.key === t.__key && i.focus.offset === u && !o.canInsertTextAfter() && !s)))
      )
        return void o.markDirty();
      const g = $r();
      if (!br(g) || null === n || null === r) return void $o(o, a, g);
      if ((g.setTextNodeRange(o, n, o, r), o.isSegmented())) {
        const t = _r(o.getTextContent());
        (o.replace(t), (o = t));
      }
      $o(o, a, g);
    }
  }
}
function $o(t, e, n) {
  if ((t.setTextContent(e), br(n))) {
    const e = t.getKey();
    for (const r of ['anchor', 'focus']) {
      const i = n[r];
      'text' === i.type && i.key === e && (i.offset = fl(t, i.offset, 'clamp'));
    }
  }
}
function Uo(t, e, n) {
  const r = e[n] || !1;
  return 'any' === r || r === t[n];
}
function Vo(t, e) {
  return Uo(t, e, 'altKey') && Uo(t, e, 'ctrlKey') && Uo(t, e, 'shiftKey') && Uo(t, e, 'metaKey');
}
function Yo(t, e, n) {
  return Vo(t, n) && t.key.toLowerCase() === e.toLowerCase();
}
const qo = { ctrlKey: !i, metaKey: i },
  Ho = { altKey: i, ctrlKey: !i };
function Go(t) {
  return 'Backspace' === t.key;
}
function Xo(t) {
  return Yo(t, 'a', qo);
}
function Qo(t) {
  const e = Fo();
  if (br(t)) {
    const e = t.anchor,
      n = t.focus,
      r = e.getNode().getTopLevelElementOrThrow().getParentOrThrow();
    return (
      e.set(r.getKey(), 0, 'element'),
      n.set(r.getKey(), r.getChildrenSize(), 'element'),
      St(t),
      t
    );
  }
  {
    const t = e.select(0, e.getChildrenSize());
    return (Io(St(t)), t);
  }
}
function Zo(t, e) {
  void 0 === t.__lexicalClassNameCache && (t.__lexicalClassNameCache = {});
  const n = t.__lexicalClassNameCache,
    r = n[e];
  if (void 0 !== r) return r;
  const i = t[e];
  if ('string' == typeof i) {
    const t = h(i);
    return ((n[e] = t), t);
  }
  return i;
}
function ts(e, n, r, i, o) {
  if (0 === r.size) return;
  const s = i.__type,
    l = i.__key,
    c = n.get(s);
  void 0 === c && t(33, s);
  const a = c.klass;
  let u = e.get(a);
  void 0 === u && ((u = new Map()), e.set(a, u));
  const f = u.get(l),
    d = 'destroyed' === f && 'created' === o;
  (void 0 === f || d) && u.set(l, d ? 'updated' : o);
}
function es(t) {
  const e = t.getType(),
    n = di();
  if (n._readOnly) {
    const t = zs(n).get(e);
    return t ? Array.from(t.values()) : [];
  }
  const r = n._nodeMap,
    i = [];
  for (const [, n] of r) n instanceof t && n.__type === e && n.isAttached() && i.push(n);
  return i;
}
function ns(t, e, n) {
  const r = t.getParent();
  let i = n,
    o = t;
  return (
    null !== r &&
      (e && 0 === n
        ? ((i = o.getIndexWithinParent()), (o = r))
        : e || n !== o.getChildrenSize() || ((i = o.getIndexWithinParent() + 1), (o = r))),
    o.getChildAtIndex(e ? i - 1 : i)
  );
}
function rs(t, e) {
  const n = t.offset;
  if ('element' === t.type) {
    return ns(t.getNode(), e, n);
  }
  {
    const r = t.getNode();
    if ((e && 0 === n) || (!e && n === r.getTextContentSize())) {
      const t = e ? r.getPreviousSibling() : r.getNextSibling();
      return null === t ? ns(r.getParentOrThrow(), e, r.getIndexWithinParent() + (e ? 0 : 1)) : t;
    }
  }
  return null;
}
function is(t) {
  const e = _s(t).event,
    n = e && e.inputType;
  return 'insertFromPaste' === n || 'insertFromPasteAsQuotation' === n;
}
function os(t, e, n) {
  return (function (t, e, n) {
    const r = Ro(t);
    for (let i = 4; i >= 0; i--)
      for (let o = 0; o < r.length; o++) {
        const s = r[o],
          l = s._commands.get(e);
        if (void 0 !== l) {
          const e = l[i];
          if (void 0 !== e) {
            const r = Array.from(e),
              i = r.length;
            let o = !1;
            if (
              (bi(s, () => {
                for (let e = 0; e < i; e++) if (r[e](n, t)) return void (o = !0);
              }),
              o)
            )
              return o;
          }
        }
      }
    return !1;
  })(t, e, n);
}
function ss(t) {
  return !Li(t) && !t.isLastChild() && !t.isInline();
}
function ls(e, n) {
  const r = e._keyToDOMMap.get(n);
  return (void 0 === r && t(75, n), r);
}
function cs(t) {
  const e = t.assignedSlot || t.parentElement;
  return As(e) ? e.host : e;
}
function as(t) {
  return xo(t) ? t : Os(t) ? t.ownerDocument : null;
}
function us(t) {
  return hi()._updateTags.has(t);
}
function fs(t) {
  ui();
  hi()._updateTags.add(t);
}
function ds(t) {
  ui();
  hi()._deferred.push(t);
}
function hs(t, e) {
  let n = t.getParent();
  for (; null !== n; ) {
    if (n.is(e)) return !0;
    n = n.getParent();
  }
  return !1;
}
function gs(t) {
  const e = as(t);
  return e ? e.defaultView : null;
}
function _s(e) {
  const n = e._window;
  return (null === n && t(78), n);
}
function ps(t) {
  return (Mi(t) && t.isInline()) || (Di(t) && t.isInline());
}
function ys(t) {
  let e = t.getParentOrThrow();
  for (; null !== e; ) {
    if (ms(e)) return e;
    e = e.getParentOrThrow();
  }
  return e;
}
function ms(t) {
  return Li(t) || (Mi(t) && t.isShadowRoot());
}
function xs(t) {
  const e = t.constructor.clone(t);
  return (ko(e, null), e.afterCloneFrom(t), e);
}
function Cs(e) {
  const n = hi(),
    r = e.getType(),
    i = so(n, r);
  void 0 === i && t(200, e.constructor.name, r);
  const { replace: o, replaceWithKlass: s } = i;
  if (null !== o) {
    const n = o(e),
      i = n.constructor;
    return (
      null !== s
        ? n instanceof s || t(201, s.name, s.getType(), i.name, i.getType(), e.constructor.name, r)
        : (n instanceof e.constructor && i !== e.constructor) ||
          t(202, i.name, i.getType(), e.constructor.name, r),
      n.__key === e.__key && t(203, e.constructor.name, r, i.name, i.getType()),
      n
    );
  }
  return e;
}
function Ss(e, n) {
  !Li(e.getParent()) || Mi(n) || Di(n) || t(99);
}
function vs(e) {
  const n = Eo(e);
  return (null === n && t(63, e), n);
}
function ks(t) {
  return (Di(t) || (Mi(t) && !t.canBeEmpty())) && !t.isInline();
}
function Ts(t, e, n) {
  (n.style.removeProperty('caret-color'), (e._blockCursorElement = null));
  const r = t.parentElement;
  null !== r && r.removeChild(t);
}
function Ns(t) {
  return n ? (t || window).getSelection() : null;
}
function bs(t) {
  const e = gs(t);
  return e ? e.getSelection() : null;
}
function ws(e, n) {
  let r = e.getChildAtIndex(n);
  (null == r && (r = e), ms(e) && t(102));
  const i = (e) => {
      const n = e.getParentOrThrow(),
        o = ms(n),
        s = e !== r || o ? xs(e) : e;
      if (o) return ((Mi(e) && Mi(s)) || t(133), e.insertAfter(s), [e, s, s]);
      {
        const [t, r, o] = i(n),
          l = e.getNextSiblings();
        return (o.append(s, ...l), [t, r, s]);
      }
    },
    [o, s] = i(r);
  return [o, s];
}
function Es(t) {
  return Os(t) && 'A' === t.tagName;
}
function Os(t) {
  return Ms(t) && 1 === t.nodeType;
}
function Ms(t) {
  return 'object' == typeof t && null !== t && 'nodeType' in t && 'number' == typeof t.nodeType;
}
function As(t) {
  return Ms(t) && 11 === t.nodeType;
}
function Ps(t) {
  const e = new RegExp(
    /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/,
    'i',
  );
  return null !== t.nodeName.match(e);
}
function Ds(t) {
  const e = new RegExp(
    /^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/,
    'i',
  );
  return null !== t.nodeName.match(e);
}
function Fs(t) {
  if (Di(t) && !t.isInline()) return !0;
  if (!Mi(t) || ms(t)) return !1;
  const e = t.getFirstChild(),
    n = null === e || Qn(e) || pr(e) || e.isInline();
  return !t.isInline() && !1 !== t.canBeEmpty() && n;
}
function Ls() {
  return hi();
}
const Is = new WeakMap(),
  Ks = new Map();
function zs(e) {
  if (!e._readOnly && e.isEmpty()) return Ks;
  e._readOnly || t(192);
  let n = Is.get(e);
  return (
    n ||
      ((n = (function (t) {
        const e = new Map();
        for (const [n, r] of t._nodeMap) {
          const t = r.__type;
          let i = e.get(t);
          (i || ((i = new Map()), e.set(t, i)), i.set(n, r));
        }
        return e;
      })(e)),
      Is.set(e, n)),
    n
  );
}
function Rs(t) {
  const e = t.constructor.clone(t);
  return (e.afterCloneFrom(t), e);
}
function Bs(t) {
  return (((e = Rs(t))[Kn] = !0), e);
  var e;
}
function Ws(t, e) {
  const n = parseInt(t.style.paddingInlineStart, 10) || 0,
    r = Math.round(n / 40);
  e.setIndent(r);
}
function Js(t) {
  t.__lexicalUnmanaged = !0;
}
function js(t) {
  return !0 === t.__lexicalUnmanaged;
}
function $s(t, e) {
  return (
    (function (t, e) {
      return Object.prototype.hasOwnProperty.call(t, e);
    })(t, e) && t[e] !== Rn[e]
  );
}
function Us(e) {
  const n = V in e.prototype ? e.prototype[V]() : void 0,
    r = (function (e) {
      if (!(e === Rn || e.prototype instanceof Rn)) {
        let n = '<unknown>',
          r = '<unknown>';
        try {
          n = e.getType();
        } catch (t) {}
        try {
          to.version && (r = JSON.parse(to.version));
        } catch (t) {}
        t(290, e.name, n, r);
      }
      return e === Pi || e === Oi || e === Rn;
    })(e),
    i = !r && $s(e, 'getType') ? e.getType() : void 0;
  let o,
    s = i;
  if (n)
    if (i) o = n[i];
    else for (const [t, e] of Object.entries(n)) ((s = t), (o = e));
  if (
    !r &&
    s &&
    ($s(e, 'getType') || (e.getType = () => s),
    $s(e, 'clone') || (e.clone = (t) => (no(t), new e())),
    $s(e, 'importJSON') ||
      (e.importJSON = (o && o.$importJSON) || ((t) => new e().updateFromJSON(t))),
    !$s(e, 'importDOM') && o)
  ) {
    const { importDOM: t } = o;
    t && (e.importDOM = () => t);
  }
  return { ownNodeConfig: o, ownNodeType: s };
}
function Vs(t) {
  const e = Ls();
  ui();
  return new (e.resolveRegisteredNodeAfterReplacements(e.getRegisteredNode(t)).klass)();
}
const Ys = (t, e) => {
    let n = t;
    for (; null != n && !Li(n); ) {
      if (e(n)) return n;
      n = n.getParent();
    }
    return null;
  },
  qs = { next: 'previous', previous: 'next' };
class Hs {
  origin;
  constructor(t) {
    this.origin = t;
  }
  [Symbol.iterator]() {
    return vl({
      hasNext: il,
      initial: this.getAdjacentCaret(),
      map: (t) => t,
      step: (t) => t.getAdjacentCaret(),
    });
  }
  getAdjacentCaret() {
    return al(this.getNodeAtCaret(), this.direction);
  }
  getSiblingCaret() {
    return al(this.origin, this.direction);
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
    const i = r === this.direction ? n : Array.from(n).reverse();
    let o = this;
    const s = this.getParentAtCaret(),
      l = new Map();
    for (let t = o.getAdjacentCaret(); null !== t && l.size < e; t = t.getAdjacentCaret()) {
      const e = t.origin.getWritable();
      l.set(e.getKey(), e);
    }
    for (const e of i) {
      if (l.size > 0) {
        const n = o.getNodeAtCaret();
        if (n)
          if ((l.delete(n.getKey()), l.delete(e.getKey()), n.is(e) || o.origin.is(e)));
          else {
            const t = e.getParent();
            (t && t.is(s) && e.remove(), n.replace(e));
          }
        else null === n && t(263, Array.from(l).join(' '));
      } else o.insert(e);
      o = al(e, this.direction);
    }
    for (const t of l.values()) t.remove();
    return this;
  }
}
class Gs extends Hs {
  type = 'child';
  getLatest() {
    const t = this.origin.getLatest();
    return t === this.origin ? this : hl(t, this.direction);
  }
  getParentCaret(t = 'root') {
    return al(Zs(this.getParentAtCaret(), t), this.direction);
  }
  getFlipped() {
    const t = Qs(this.direction);
    return al(this.getNodeAtCaret(), t) || hl(this.origin, t);
  }
  getParentAtCaret() {
    return this.origin;
  }
  getChildCaret() {
    return this;
  }
  isSameNodeCaret(t) {
    return t instanceof Gs && this.direction === t.direction && this.origin.is(t.origin);
  }
  isSamePointCaret(t) {
    return this.isSameNodeCaret(t);
  }
}
const Xs = { root: Li, shadowRoot: ms };
function Qs(t) {
  return qs[t];
}
function Zs(t, e = 'root') {
  return Xs[e](t) ? null : t;
}
class tl extends Hs {
  type = 'sibling';
  getLatest() {
    const t = this.origin.getLatest();
    return t === this.origin ? this : al(t, this.direction);
  }
  getSiblingCaret() {
    return this;
  }
  getParentAtCaret() {
    return this.origin.getParent();
  }
  getChildCaret() {
    return Mi(this.origin) ? hl(this.origin, this.direction) : null;
  }
  getParentCaret(t = 'root') {
    return al(Zs(this.getParentAtCaret(), t), this.direction);
  }
  getFlipped() {
    const t = Qs(this.direction);
    return al(this.getNodeAtCaret(), t) || hl(this.origin.getParentOrThrow(), t);
  }
  isSamePointCaret(t) {
    return t instanceof tl && this.direction === t.direction && this.origin.is(t.origin);
  }
  isSameNodeCaret(t) {
    return (
      (t instanceof tl || t instanceof el) &&
      this.direction === t.direction &&
      this.origin.is(t.origin)
    );
  }
}
class el extends Hs {
  type = 'text';
  offset;
  constructor(t, e) {
    (super(t), (this.offset = e));
  }
  getLatest() {
    const t = this.origin.getLatest();
    return t === this.origin ? this : ul(t, this.direction, this.offset);
  }
  getParentAtCaret() {
    return this.origin.getParent();
  }
  getChildCaret() {
    return null;
  }
  getParentCaret(t = 'root') {
    return al(Zs(this.getParentAtCaret(), t), this.direction);
  }
  getFlipped() {
    return ul(this.origin, Qs(this.direction), this.offset);
  }
  isSamePointCaret(t) {
    return (
      t instanceof el &&
      this.direction === t.direction &&
      this.origin.is(t.origin) &&
      this.offset === t.offset
    );
  }
  isSameNodeCaret(t) {
    return (
      (t instanceof tl || t instanceof el) &&
      this.direction === t.direction &&
      this.origin.is(t.origin)
    );
  }
  getSiblingCaret() {
    return al(this.origin, this.direction);
  }
}
function nl(t) {
  return t instanceof el;
}
function rl(t) {
  return t instanceof Hs;
}
function il(t) {
  return t instanceof tl;
}
function ol(t) {
  return t instanceof Gs;
}
const sl = {
    next: class extends el {
      direction = 'next';
      getNodeAtCaret() {
        return this.origin.getNextSibling();
      }
      insert(t) {
        return (this.origin.insertAfter(t), this);
      }
    },
    previous: class extends el {
      direction = 'previous';
      getNodeAtCaret() {
        return this.origin.getPreviousSibling();
      }
      insert(t) {
        return (this.origin.insertBefore(t), this);
      }
    },
  },
  ll = {
    next: class extends tl {
      direction = 'next';
      getNodeAtCaret() {
        return this.origin.getNextSibling();
      }
      insert(t) {
        return (this.origin.insertAfter(t), this);
      }
    },
    previous: class extends tl {
      direction = 'previous';
      getNodeAtCaret() {
        return this.origin.getPreviousSibling();
      }
      insert(t) {
        return (this.origin.insertBefore(t), this);
      }
    },
  },
  cl = {
    next: class extends Gs {
      direction = 'next';
      getNodeAtCaret() {
        return this.origin.getFirstChild();
      }
      insert(t) {
        return (this.origin.splice(0, 0, [t]), this);
      }
    },
    previous: class extends Gs {
      direction = 'previous';
      getNodeAtCaret() {
        return this.origin.getLastChild();
      }
      insert(t) {
        return (this.origin.splice(this.origin.getChildrenSize(), 0, [t]), this);
      }
    },
  };
function al(t, e) {
  return t ? new ll[e](t) : null;
}
function ul(t, e, n) {
  return t ? new sl[e](t, fl(t, n)) : null;
}
function fl(t, n, r = 'error') {
  const i = t.getTextContentSize();
  let o = 'next' === n ? i : 'previous' === n ? 0 : n;
  return (
    (o < 0 || o > i) &&
      ('clamp' !== r && e(284, String(n), String(i), t.getKey()), (o = o < 0 ? 0 : i)),
    o
  );
}
function dl(t, e) {
  return new yl(t, e);
}
function hl(t, e) {
  return Mi(t) ? new cl[e](t) : null;
}
function gl(t) {
  return (t && t.getChildCaret()) || t;
}
function _l(t) {
  return t && gl(t.getAdjacentCaret());
}
class pl {
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
    return t === this.anchor && e === this.focus ? this : new pl(t, e, this.direction);
  }
  isCollapsed() {
    return this.anchor.isSamePointCaret(this.focus);
  }
  getTextSlices() {
    const t = (t) => {
        const e = this[t].getLatest();
        return nl(e)
          ? (function (t, e) {
              const { direction: n, origin: r } = t,
                i = fl(r, 'focus' === e ? Qs(n) : n);
              return dl(t, i - t.offset);
            })(e, t)
          : null;
      },
      e = t('anchor'),
      n = t('focus');
    if (e && n) {
      const { caret: t } = e,
        { caret: r } = n;
      if (t.isSameNodeCaret(r)) return [dl(t, r.offset - t.offset), null];
    }
    return [e, n];
  }
  iterNodeCarets(t = 'root') {
    const e = nl(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(),
      n = this.focus.getLatest(),
      r = nl(n),
      i = (e) => (e.isSameNodeCaret(n) ? null : _l(e) || e.getParentCaret(t));
    return vl({
      hasNext: (t) => null !== t && !(r && n.isSameNodeCaret(t)),
      initial: e.isSameNodeCaret(n) ? null : i(e),
      map: (t) => t,
      step: i,
    });
  }
  [Symbol.iterator]() {
    return this.iterNodeCarets('root');
  }
}
class yl {
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
      i = t.getTextContent();
    return ul(t.setTextContent(i.slice(0, n) + i.slice(r)), e, n);
  }
}
function ml(t) {
  return t instanceof yl;
}
function xl(t) {
  return Sl(t, al(Fo(), t.direction));
}
function Cl(t) {
  return Sl(t, t);
}
function Sl(e, n) {
  return (e.direction !== n.direction && t(265), new pl(e, n, e.direction));
}
function vl(t) {
  const { initial: e, hasNext: n, step: r, map: i } = t;
  let o = e;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      if (!n(o)) return { done: !0, value: void 0 };
      const t = { done: !1, value: i(o) };
      return ((o = r(o)), t);
    },
  };
}
function kl(e, n) {
  const r = wl(e.origin, n.origin);
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
      return Tl(r);
  }
}
function Tl(t) {
  const { a: e, b: n } = t,
    r = e.__key,
    i = n.__key;
  let o = e,
    s = n;
  for (; o && s; o = o.getNextSibling(), s = s.getNextSibling()) {
    if (o.__key === i) return -1;
    if (s.__key === r) return 1;
  }
  return null === o ? 1 : -1;
}
function Nl(t, e) {
  return e.is(t);
}
function bl(t) {
  return Mi(t) ? [t.getLatest(), null] : [t.getParent(), t.getLatest()];
}
function wl(e, n) {
  if (e.is(n)) return { commonAncestor: e, type: 'same' };
  const r = new Map();
  for (let [t, n] = bl(e); t; n = t, t = t.getParent()) r.set(t, n);
  for (let [i, o] = bl(n); i; o = i, i = i.getParent()) {
    const s = r.get(i);
    if (void 0 !== s)
      return null === s
        ? (Nl(e, i) || t(276), { commonAncestor: i, type: 'ancestor' })
        : null === o
          ? (Nl(n, i) || t(277), { commonAncestor: i, type: 'descendant' })
          : (((Mi(s) || Nl(e, s)) &&
              (Mi(o) || Nl(n, o)) &&
              i.is(s.getParent()) &&
              i.is(o.getParent())) ||
              t(278),
            { a: s, b: o, commonAncestor: i, type: 'branch' });
  }
  return null;
}
function El(e, n) {
  const { type: r, key: i, offset: o } = e,
    s = vs(e.key);
  return 'text' === r
    ? (pr(s) || t(266, s.getType(), i), ul(s, n, o))
    : (Mi(s) || t(267, s.getType(), i), Wl(s, e.offset, n));
}
function Ol(e, n) {
  const { origin: r, direction: i } = n,
    o = 'next' === i;
  nl(n)
    ? e.set(r.getKey(), n.offset, 'text')
    : il(n)
      ? pr(r)
        ? e.set(r.getKey(), fl(r, i), 'text')
        : e.set(r.getParentOrThrow().getKey(), r.getIndexWithinParent() + (o ? 1 : 0), 'element')
      : ((ol(n) && Mi(r)) || t(268), e.set(r.getKey(), o ? 0 : r.getChildrenSize(), 'element'));
}
function Ml(t) {
  const e = $r(),
    n = br(e) ? e : Br();
  return (Al(n, t), Io(n), n);
}
function Al(t, e) {
  (Ol(t.anchor, e.anchor), Ol(t.focus, e.focus));
}
function Pl(t) {
  const { anchor: e, focus: n } = t,
    r = El(e, 'next'),
    i = El(n, 'next'),
    o = kl(r, i) <= 0 ? 'next' : 'previous';
  return Sl(Rl(r, o), Rl(i, o));
}
function Dl(t) {
  const { direction: e, origin: n } = t,
    r = al(n, Qs(e)).getNodeAtCaret();
  return r ? al(r, e) : hl(n.getParentOrThrow(), e);
}
function Fl(t, e = 'root') {
  const n = [t];
  for (
    let r = ol(t) ? t.getParentCaret(e) : t.getSiblingCaret();
    null !== r;
    r = r.getParentCaret(e)
  )
    n.push(Dl(r));
  return n;
}
function Ll(t) {
  return !!t && t.origin.isAttached();
}
function Il(e, n = 'removeEmptySlices') {
  if (e.isCollapsed()) return e;
  const r = 'root',
    i = 'next';
  let o = n;
  const s = Bl(e, i),
    l = Fl(s.anchor, r),
    c = Fl(s.focus.getFlipped(), r),
    a = new Set(),
    u = [];
  for (const t of s.iterNodeCarets(r))
    if (ol(t)) a.add(t.origin.getKey());
    else if (il(t)) {
      const { origin: e } = t;
      (Mi(e) && !a.has(e.getKey())) || u.push(e);
    }
  for (const t of u) t.remove();
  for (const t of s.getTextSlices()) {
    if (!t) continue;
    const { origin: e } = t.caret,
      n = e.getTextContentSize(),
      r = Dl(al(e, i)),
      s = e.getMode();
    if (
      (Math.abs(t.distance) === n && 'removeEmptySlices' === o) ||
      ('token' === s && 0 !== t.distance)
    )
      r.remove();
    else if (0 !== t.distance) {
      o = 'removeEmptySlices';
      let e = t.removeTextSlice();
      const n = t.caret.origin;
      if ('segmented' === s) {
        const t = e.origin,
          n = _r(t.getTextContent()).setStyle(t.getStyle()).setFormat(t.getFormat());
        (r.replaceOrInsert(n), (e = ul(n, i, e.offset)));
      }
      (n.is(l[0].origin) && (l[0] = e), n.is(c[0].origin) && (c[0] = e.getFlipped()));
    }
  }
  let f, d;
  for (const t of l)
    if (Ll(t)) {
      f = Kl(t);
      break;
    }
  for (const t of c)
    if (Ll(t)) {
      d = Kl(t);
      break;
    }
  const h = (function (t, e, n) {
    if (!t || !e) return null;
    const r = t.getParentAtCaret(),
      i = e.getParentAtCaret();
    if (!r || !i) return null;
    const o = r.getParents().reverse();
    o.push(r);
    const s = i.getParents().reverse();
    s.push(i);
    const l = Math.min(o.length, s.length);
    let c;
    for (c = 0; c < l && o[c] === s[c]; c++);
    const a = (t, e) => {
        let n;
        for (let r = c; r < t.length; r++) {
          const i = t[r];
          if (ms(i)) return;
          !n && e(i) && (n = i);
        }
        return n;
      },
      u = a(o, Fs),
      f = u && a(s, (t) => n.has(t.getKey()) && Fs(t));
    return u && f ? [u, f] : null;
  })(f, d, a);
  if (h) {
    const [t, e] = h;
    (hl(t, 'previous').splice(0, e.getChildren()), e.remove());
  }
  const g = [f, d, ...l, ...c].find(Ll);
  if (g) {
    return Cl(Rl(Kl(g), e.direction));
  }
  t(269, JSON.stringify(l.map((t) => t.origin.__key)));
}
function Kl(t) {
  const e = (function (t) {
      let e = t;
      for (; ol(e); ) {
        const t = _l(e);
        if (!ol(t)) break;
        e = t;
      }
      return e;
    })(t.getLatest()),
    { direction: n } = e;
  if (pr(e.origin)) return nl(e) ? e : ul(e.origin, n, n);
  const r = e.getAdjacentCaret();
  return il(r) && pr(r.origin) ? ul(r.origin, n, Qs(n)) : e;
}
function zl(t) {
  return nl(t) && t.offset !== fl(t.origin, t.direction);
}
function Rl(t, e) {
  return t.direction === e ? t : t.getFlipped();
}
function Bl(t, e) {
  return t.direction === e ? t : Sl(Rl(t.focus, e), Rl(t.anchor, e));
}
function Wl(t, e, n) {
  let r = hl(t, 'next');
  for (let t = 0; t < e; t++) {
    const t = r.getAdjacentCaret();
    if (null === t) break;
    r = t;
  }
  return Rl(r, n);
}
function Jl(t, e = 'root') {
  let n = 0,
    r = t,
    i = _l(r);
  for (; null === i; ) {
    if ((n--, (i = r.getParentCaret(e)), !i)) return null;
    ((r = i), (i = _l(r)));
  }
  return i && [i, n];
}
function jl(e) {
  const { origin: n, offset: r, direction: i } = e;
  if (r === fl(n, i)) return e.getSiblingCaret();
  if (r === fl(n, Qs(i))) return Dl(e.getSiblingCaret());
  const [o] = n.splitText(r);
  return (pr(o) || t(281), Rl(al(o, 'next'), i));
}
function $l(t, e) {
  return !0;
}
function Ul(
  t,
  {
    $copyElementNode: e = xs,
    $splitTextPointCaretNext: n = jl,
    rootMode: r = 'shadowRoot',
    $shouldSplit: i = $l,
  } = {},
) {
  if (nl(t)) return n(t);
  const o = t.getParentCaret(r);
  if (o) {
    const { origin: n } = o;
    if (ol(t) && (!n.canBeEmpty() || !i(n, 'first'))) return Dl(o);
    const r = (function (t) {
      const e = [];
      for (let n = t.getAdjacentCaret(); n; n = n.getAdjacentCaret()) e.push(n.origin);
      return e;
    })(t);
    (r.length > 0 || (n.canBeEmpty() && i(n, 'last'))) && o.insert(e(n).splice(0, 0, r));
  }
  return o;
}
function Vl(t) {
  return t;
}
function Yl(...t) {
  return t;
}
function ql(t, e) {
  return [t, e];
}
function Hl(t) {
  return t;
}
function Gl(t, e) {
  if (!e || t === e) return t;
  for (const n in e) if (t[n] !== e[n]) return { ...t, ...e };
  return t;
}
export {
  fs as $addUpdateTag,
  Cs as $applyNodeReplacement,
  El as $caretFromPoint,
  Pl as $caretRangeFromSelection,
  Rs as $cloneWithProperties,
  Bs as $cloneWithPropertiesEphemeral,
  kl as $comparePointCaretNext,
  xs as $copyNode,
  Vs as $create,
  Xn as $createLineBreakNode,
  Wr as $createNodeSelection,
  $i as $createParagraphNode,
  vr as $createPoint,
  Br as $createRangeSelection,
  Jr as $createRangeSelectionFromDom,
  xr as $createTabNode,
  _r as $createTextNode,
  xl as $extendCaretToRange,
  Ys as $findMatchingParent,
  _l as $getAdjacentChildCaret,
  rs as $getAdjacentNode,
  Jl as $getAdjacentSiblingOrParentSiblingCaret,
  Rl as $getCaretInDirection,
  Sl as $getCaretRange,
  Bl as $getCaretRangeInDirection,
  Mr as $getCharacterOffsets,
  hl as $getChildCaret,
  Wl as $getChildCaretAtIndex,
  gl as $getChildCaretOrSelf,
  Cl as $getCollapsedCaretRange,
  wl as $getCommonAncestor,
  Tl as $getCommonAncestorResultBranchOrder,
  Ls as $getEditor,
  Ao as $getNearestNodeFromDOMNode,
  ys as $getNearestRootOrShadowRoot,
  Eo as $getNodeByKey,
  vs as $getNodeByKeyOrThrow,
  Oo as $getNodeFromDOMNode,
  Ur as $getPreviousSelection,
  Fo as $getRoot,
  $r as $getSelection,
  al as $getSiblingCaret,
  st as $getState,
  lt as $getStateChange,
  Zr as $getTextContent,
  fl as $getTextNodeOffset,
  ul as $getTextPointCaret,
  dl as $getTextPointCaretSlice,
  ft as $getWritableNodeState,
  hs as $hasAncestor,
  us as $hasUpdateTag,
  Qr as $insertNodes,
  zr as $isBlockElementNode,
  ol as $isChildCaret,
  Di as $isDecoratorNode,
  Ri as $isEditorState,
  Mi as $isElementNode,
  zl as $isExtendableTextPointCaret,
  ps as $isInlineElementOrDecoratorNode,
  vo as $isLeafNode,
  Qn as $isLineBreakNode,
  rl as $isNodeCaret,
  Er as $isNodeSelection,
  Ui as $isParagraphNode,
  br as $isRangeSelection,
  Li as $isRootNode,
  ms as $isRootOrShadowRoot,
  il as $isSiblingCaret,
  Cr as $isTabNode,
  pr as $isTextNode,
  nl as $isTextPointCaret,
  ml as $isTextPointCaretSlice,
  yo as $isTokenOrSegmented,
  po as $isTokenOrTab,
  es as $nodesOfType,
  Kl as $normalizeCaret,
  St as $normalizeSelection__EXPERIMENTAL,
  ds as $onUpdate,
  xi as $parseSerializedNode,
  Il as $removeTextFromCaretRange,
  Dl as $rewindSiblingCaret,
  Qo as $selectAll,
  bo as $setCompositionKey,
  Ol as $setPointFromCaret,
  Io as $setSelection,
  Ml as $setSelectionFromCaretRange,
  ct as $setState,
  Ul as $splitAtPointCaretNext,
  ws as $splitNode,
  Al as $updateRangeSelectionFromCaretRange,
  Wi as ArtificialNode__DO_NOT_USE,
  le as BEFORE_INPUT_COMMAND,
  Xe as BLUR_COMMAND,
  qe as CAN_REDO_COMMAND,
  He as CAN_UNDO_COMMAND,
  Ve as CLEAR_EDITOR_COMMAND,
  Ye as CLEAR_HISTORY_COMMAND,
  se as CLICK_COMMAND,
  $n as COLLABORATION_TAG,
  Gi as COMMAND_PRIORITY_CRITICAL,
  Vi as COMMAND_PRIORITY_EDITOR,
  Hi as COMMAND_PRIORITY_HIGH,
  Yi as COMMAND_PRIORITY_LOW,
  qi as COMMAND_PRIORITY_NORMAL,
  ue as COMPOSITION_END_COMMAND,
  ae as COMPOSITION_START_COMMAND,
  ge as CONTROLLED_TEXT_INSERTION_COMMAND,
  je as COPY_COMMAND,
  $e as CUT_COMMAND,
  fe as DELETE_CHARACTER_COMMAND,
  me as DELETE_LINE_COMMAND,
  ye as DELETE_WORD_COMMAND,
  Je as DRAGEND_COMMAND,
  We as DRAGOVER_COMMAND,
  Be as DRAGSTART_COMMAND,
  ze as DROP_COMMAND,
  Pi as DecoratorNode,
  Oi as ElementNode,
  Ge as FOCUS_COMMAND,
  Re as FORMAT_ELEMENT_COMMAND,
  xe as FORMAT_TEXT_COMMAND,
  Bn as HISTORIC_TAG,
  Jn as HISTORY_MERGE_TAG,
  Wn as HISTORY_PUSH_TAG,
  Ie as INDENT_CONTENT_COMMAND,
  ce as INPUT_COMMAND,
  de as INSERT_LINE_BREAK_COMMAND,
  he as INSERT_PARAGRAPH_COMMAND,
  Le as INSERT_TAB_COMMAND,
  Fs as INTERNAL_$isBlock,
  N as IS_ALL_FORMATTING,
  y as IS_BOLD,
  S as IS_CODE,
  T as IS_HIGHLIGHT,
  m as IS_ITALIC,
  x as IS_STRIKETHROUGH,
  v as IS_SUBSCRIPT,
  k as IS_SUPERSCRIPT,
  C as IS_UNDERLINE,
  Ee as KEY_ARROW_DOWN_COMMAND,
  Ne as KEY_ARROW_LEFT_COMMAND,
  ke as KEY_ARROW_RIGHT_COMMAND,
  we as KEY_ARROW_UP_COMMAND,
  Ae as KEY_BACKSPACE_COMMAND,
  De as KEY_DELETE_COMMAND,
  ve as KEY_DOWN_COMMAND,
  Oe as KEY_ENTER_COMMAND,
  Pe as KEY_ESCAPE_COMMAND,
  Qe as KEY_MODIFIER_COMMAND,
  Me as KEY_SPACE_COMMAND,
  Fe as KEY_TAB_COMMAND,
  Hn as LineBreakNode,
  Te as MOVE_TO_END,
  be as MOVE_TO_START,
  U as NODE_STATE_KEY,
  Ke as OUTDENT_CONTENT_COMMAND,
  _e as PASTE_COMMAND,
  jn as PASTE_TAG,
  Ji as ParagraphNode,
  Se as REDO_COMMAND,
  pe as REMOVE_TEXT_COMMAND,
  Fi as RootNode,
  ie as SELECTION_CHANGE_COMMAND,
  oe as SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  Ue as SELECT_ALL_COMMAND,
  Un as SKIP_COLLAB_TAG,
  Yn as SKIP_DOM_SELECTION_TAG,
  Vn as SKIP_SCROLL_INTO_VIEW_TAG,
  qn as SKIP_SELECTION_FOCUS_TAG,
  R as TEXT_TYPE_TO_FORMAT,
  mr as TabNode,
  sr as TextNode,
  Ce as UNDO_COMMAND,
  In as buildImportMap,
  Yl as configExtension,
  re as createCommand,
  Zi as createEditor,
  at as createSharedNodeState,
  ot as createState,
  ql as declarePeerDependency,
  Vl as defineExtension,
  Qs as flipDirection,
  as as getDOMOwnerDocument,
  Ns as getDOMSelection,
  bs as getDOMSelectionFromTarget,
  Co as getDOMTextNode,
  go as getEditorPropertyFromDOMNode,
  ho as getNearestEditorFromDOMNode,
  so as getRegisteredNode,
  oo as getRegisteredNodeOrThrow,
  Us as getStaticNodeConfig,
  _o as getTextDirection,
  Qi as getTransformSetFromKlass,
  Ds as isBlockDomNode,
  ai as isCurrentlyReadOnlyMode,
  xo as isDOMDocumentNode,
  Ms as isDOMNode,
  mo as isDOMTextNode,
  js as isDOMUnmanaged,
  As as isDocumentFragment,
  Yo as isExactShortcutMatch,
  Es as isHTMLAnchorElement,
  Os as isHTMLElement,
  Ps as isInlineDomNode,
  fo as isLexicalEditor,
  Vo as isModifierMatch,
  ao as isSelectionCapturedInDecoratorInput,
  uo as isSelectionWithinEditor,
  vl as makeStepwiseIterator,
  To as removeFromParent,
  io as resetRandomKey,
  Hl as safeCast,
  Js as setDOMUnmanaged,
  Ws as setNodeIndentFromDOM,
  Gl as shallowMergeConfig,
};
