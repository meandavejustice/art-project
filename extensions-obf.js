/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
window.PolymerGestures = {};
(function(scope) {
    var hasFullPath = false;
    var pathTest = document.createElement("meta");
    if (pathTest.createShadowRoot) {
        var sr = pathTest.createShadowRoot();
        var s = document.createElement("span");
        sr.appendChild(s);
        pathTest.addEventListener("testpath", function(ev) {
            if (ev.path) {
                hasFullPath = ev.path[0] === s
            }
            ev.stopPropagation()
        }
        );
        var ev = new CustomEvent("testpath",{
            bubbles: true
        });
        document.head.appendChild(pathTest);
        s.dispatchEvent(ev);
        pathTest.parentNode.removeChild(pathTest);
        sr = s = null 
    }
    pathTest = null ;
    var target = {
        shadow: function(inEl) {
            if (inEl) {
                return inEl.shadowRoot || inEl.webkitShadowRoot
            }
        },
        canTarget: function(shadow) {
            return shadow && Boolean(shadow.elementFromPoint)
        },
        targetingShadow: function(inEl) {
            var s = this.shadow(inEl);
            if (this.canTarget(s)) {
                return s
            }
        },
        olderShadow: function(shadow) {
            var os = shadow.olderShadowRoot;
            if (!os) {
                var se = shadow.querySelector("shadow");
                if (se) {
                    os = se.olderShadowRoot
                }
            }
            return os
        },
        allShadows: function(element) {
            var shadows = []
              , s = this.shadow(element);
            while (s) {
                shadows.push(s);
                s = this.olderShadow(s)
            }
            return shadows
        },
        searchRoot: function(inRoot, x, y) {
            var t, st, sr, os;
            if (inRoot) {
                t = inRoot.elementFromPoint(x, y);
                if (t) {
                    sr = this.targetingShadow(t)
                } else if (inRoot !== document) {
                    sr = this.olderShadow(inRoot)
                }
                return this.searchRoot(sr, x, y) || t
            }
        },
        owner: function(element) {
            if (!element) {
                return document
            }
            var s = element;
            while (s.parentNode) {
                s = s.parentNode
            }
            if (s.nodeType != Node.DOCUMENT_NODE && s.nodeType != Node.DOCUMENT_FRAGMENT_NODE) {
                s = document
            }
            return s
        },
        findTarget: function(inEvent) {
            if (hasFullPath && inEvent.path && inEvent.path.length) {
                return inEvent.path[0]
            }
            var x = inEvent.clientX
              , y = inEvent.clientY;
            var s = this.owner(inEvent.target);
            if (!s.elementFromPoint(x, y)) {
                s = document
            }
            return this.searchRoot(s, x, y)
        },
        findTouchAction: function(inEvent) {
            var n;
            if (hasFullPath && inEvent.path && inEvent.path.length) {
                var path = inEvent.path;
                for (var i = 0; i < path.length; i++) {
                    n = path[i];
                    if (n.nodeType === Node.ELEMENT_NODE && n.hasAttribute("touch-action")) {
                        return n.getAttribute("touch-action")
                    }
                }
            } else {
                n = inEvent.target;
                while (n) {
                    if (n.nodeType === Node.ELEMENT_NODE && n.hasAttribute("touch-action")) {
                        return n.getAttribute("touch-action")
                    }
                    n = n.parentNode || n.host
                }
            }
            return "auto"
        },
        LCA: function(a, b) {
            if (a === b) {
                return a
            }
            if (a && !b) {
                return a
            }
            if (b && !a) {
                return b
            }
            if (!b && !a) {
                return document
            }
            if (a.contains && a.contains(b)) {
                return a
            }
            if (b.contains && b.contains(a)) {
                return b
            }
            var adepth = this.depth(a);
            var bdepth = this.depth(b);
            var d = adepth - bdepth;
            if (d >= 0) {
                a = this.walk(a, d)
            } else {
                b = this.walk(b, -d)
            }
            while (a && b && a !== b) {
                a = a.parentNode || a.host;
                b = b.parentNode || b.host
            }
            return a
        },
        walk: function(n, u) {
            for (var i = 0; n && i < u; i++) {
                n = n.parentNode || n.host
            }
            return n
        },
        depth: function(n) {
            var d = 0;
            while (n) {
                d++;
                n = n.parentNode || n.host
            }
            return d
        },
        deepContains: function(a, b) {
            var common = this.LCA(a, b);
            return common === a
        },
        insideNode: function(node, x, y) {
            var rect = node.getBoundingClientRect();
            return rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom
        },
        path: function(event) {
            var p;
            if (hasFullPath && event.path && event.path.length) {
                p = event.path
            } else {
                p = [];
                var n = this.findTarget(event);
                while (n) {
                    p.push(n);
                    n = n.parentNode || n.host
                }
            }
            return p
        }
    };
    scope.targetFinding = target;
    scope.findTarget = target.findTarget.bind(target);
    scope.deepContains = target.deepContains.bind(target);
    scope.insideNode = target.insideNode
}
)(window.PolymerGestures);
(function() {
    function shadowSelector(v) {
        return "html /deep/ " + selector(v)
    }
    function selector(v) {
        return '[touch-action="' + v + '"]'
    }
    function rule(v) {
        return "{ -ms-touch-action: " + v + "; touch-action: " + v + ";}"
    }
    var attrib2css = ["none", "auto", "pan-x", "pan-y", {
        rule: "pan-x pan-y",
        selectors: ["pan-x pan-y", "pan-y pan-x"]
    }, "manipulation"];
    var styles = "";
    var hasTouchAction = typeof document.head.style.touchAction === "string";
    var hasShadowRoot = !window.ShadowDOMPolyfill && document.head.createShadowRoot;
    if (hasTouchAction) {
        attrib2css.forEach(function(r) {
            if (String(r) === r) {
                styles += selector(r) + rule(r) + "\n";
                if (hasShadowRoot) {
                    styles += shadowSelector(r) + rule(r) + "\n"
                }
            } else {
                styles += r.selectors.map(selector) + rule(r.rule) + "\n";
                if (hasShadowRoot) {
                    styles += r.selectors.map(shadowSelector) + rule(r.rule) + "\n"
                }
            }
        }
        );
        var el = document.createElement("style");
        el.textContent = styles;
        document.head.appendChild(el)
    }
}
)();
(function(scope) {
    var MOUSE_PROPS = ["bubbles", "cancelable", "view", "detail", "screenX", "screenY", "clientX", "clientY", "ctrlKey", "altKey", "shiftKey", "metaKey", "button", "relatedTarget", "pageX", "pageY"];
    var MOUSE_DEFAULTS = [false, false, null , null , 0, 0, 0, 0, false, false, false, false, 0, null , 0, 0];
    var NOP_FACTORY = function() {
        return function() {}
    }
    ;
    var eventFactory = {
        preventTap: NOP_FACTORY,
        makeBaseEvent: function(inType, inDict) {
            var e = document.createEvent("Event");
            e.initEvent(inType, inDict.bubbles || false, inDict.cancelable || false);
            e.preventTap = eventFactory.preventTap(e);
            return e
        },
        makeGestureEvent: function(inType, inDict) {
            inDict = inDict || Object.create(null );
            var e = this.makeBaseEvent(inType, inDict);
            for (var i = 0, keys = Object.keys(inDict), k; i < keys.length; i++) {
                k = keys[i];
                if (k !== "bubbles" && k !== "cancelable") {
                    e[k] = inDict[k]
                }
            }
            return e
        },
        makePointerEvent: function(inType, inDict) {
            inDict = inDict || Object.create(null );
            var e = this.makeBaseEvent(inType, inDict);
            for (var i = 2, p; i < MOUSE_PROPS.length; i++) {
                p = MOUSE_PROPS[i];
                e[p] = inDict[p] || MOUSE_DEFAULTS[i]
            }
            e.buttons = inDict.buttons || 0;
            var pressure = 0;
            if (inDict.pressure) {
                pressure = inDict.pressure
            } else {
                pressure = e.buttons ? .5 : 0
            }
            e.x = e.clientX;
            e.y = e.clientY;
            e.pointerId = inDict.pointerId || 0;
            e.width = inDict.width || 0;
            e.height = inDict.height || 0;
            e.pressure = pressure;
            e.tiltX = inDict.tiltX || 0;
            e.tiltY = inDict.tiltY || 0;
            e.pointerType = inDict.pointerType || "";
            e.hwTimestamp = inDict.hwTimestamp || 0;
            e.isPrimary = inDict.isPrimary || false;
            e._source = inDict._source || "";
            return e
        }
    };
    scope.eventFactory = eventFactory
}
)(window.PolymerGestures);
(function(scope) {
    var USE_MAP = window.Map && window.Map.prototype.forEach;
    var POINTERS_FN = function() {
        return this.size
    }
    ;
    function PointerMap() {
        if (USE_MAP) {
            var m = new Map;
            m.pointers = POINTERS_FN;
            return m
        } else {
            this.keys = [];
            this.values = []
        }
    }
    PointerMap.prototype = {
        set: function(inId, inEvent) {
            var i = this.keys.indexOf(inId);
            if (i > -1) {
                this.values[i] = inEvent
            } else {
                this.keys.push(inId);
                this.values.push(inEvent)
            }
        },
        has: function(inId) {
            return this.keys.indexOf(inId) > -1
        },
        "delete": function(inId) {
            var i = this.keys.indexOf(inId);
            if (i > -1) {
                this.keys.splice(i, 1);
                this.values.splice(i, 1)
            }
        },
        get: function(inId) {
            var i = this.keys.indexOf(inId);
            return this.values[i]
        },
        clear: function() {
            this.keys.length = 0;
            this.values.length = 0
        },
        forEach: function(callback, thisArg) {
            this.values.forEach(function(v, i) {
                callback.call(thisArg, v, this.keys[i], this)
            }
            , this)
        },
        pointers: function() {
            return this.keys.length
        }
    };
    scope.PointerMap = PointerMap
}
)(window.PolymerGestures);
(function(scope) {
    var CLONE_PROPS = ["bubbles", "cancelable", "view", "detail", "screenX", "screenY", "clientX", "clientY", "ctrlKey", "altKey", "shiftKey", "metaKey", "button", "relatedTarget", "buttons", "pointerId", "width", "height", "pressure", "tiltX", "tiltY", "pointerType", "hwTimestamp", "isPrimary", "type", "target", "currentTarget", "which", "pageX", "pageY", "timeStamp", "preventTap", "tapPrevented", "_source"];
    var CLONE_DEFAULTS = [false, false, null , null , 0, 0, 0, 0, false, false, false, false, 0, null , 0, 0, 0, 0, 0, 0, 0, "", 0, false, "", null , null , 0, 0, 0, 0, function() {}
    , false];
    var HAS_SVG_INSTANCE = typeof SVGElementInstance !== "undefined";
    var eventFactory = scope.eventFactory;
    var currentGestures;
    var dispatcher = {
        IS_IOS: false,
        pointermap: new scope.PointerMap,
        requiredGestures: new scope.PointerMap,
        eventMap: Object.create(null ),
        eventSources: Object.create(null ),
        eventSourceList: [],
        gestures: [],
        dependencyMap: {
            down: {
                listeners: 0,
                index: -1
            },
            up: {
                listeners: 0,
                index: -1
            }
        },
        gestureQueue: [],
        registerSource: function(name, source) {
            var s = source;
            var newEvents = s.events;
            if (newEvents) {
                newEvents.forEach(function(e) {
                    if (s[e]) {
                        this.eventMap[e] = s[e].bind(s)
                    }
                }
                , this);
                this.eventSources[name] = s;
                this.eventSourceList.push(s)
            }
        },
        registerGesture: function(name, source) {
            var obj = Object.create(null );
            obj.listeners = 0;
            obj.index = this.gestures.length;
            for (var i = 0, g; i < source.exposes.length; i++) {
                g = source.exposes[i].toLowerCase();
                this.dependencyMap[g] = obj
            }
            this.gestures.push(source)
        },
        register: function(element, initial) {
            var l = this.eventSourceList.length;
            for (var i = 0, es; i < l && (es = this.eventSourceList[i]); i++) {
                es.register.call(es, element, initial)
            }
        },
        unregister: function(element) {
            var l = this.eventSourceList.length;
            for (var i = 0, es; i < l && (es = this.eventSourceList[i]); i++) {
                es.unregister.call(es, element)
            }
        },
        down: function(inEvent) {
            this.requiredGestures.set(inEvent.pointerId, currentGestures);
            this.fireEvent("down", inEvent)
        },
        move: function(inEvent) {
            inEvent.type = "move";
            this.fillGestureQueue(inEvent)
        },
        up: function(inEvent) {
            this.fireEvent("up", inEvent);
            this.requiredGestures.delete(inEvent.pointerId)
        },
        cancel: function(inEvent) {
            inEvent.tapPrevented = true;
            this.fireEvent("up", inEvent);
            this.requiredGestures.delete(inEvent.pointerId)
        },
        addGestureDependency: function(node, currentGestures) {
            var gesturesWanted = node._pgEvents;
            if (gesturesWanted && currentGestures) {
                var gk = Object.keys(gesturesWanted);
                for (var i = 0, r, ri, g; i < gk.length; i++) {
                    g = gk[i];
                    if (gesturesWanted[g] > 0) {
                        r = this.dependencyMap[g];
                        ri = r ? r.index : -1;
                        currentGestures[ri] = true
                    }
                }
            }
        },
        eventHandler: function(inEvent) {
            var type = inEvent.type;
            if (type === "touchstart" || type === "mousedown" || type === "pointerdown" || type === "MSPointerDown") {
                if (!inEvent._handledByPG) {
                    currentGestures = {}
                }
                if (this.IS_IOS) {
                    var ev = inEvent;
                    if (type === "touchstart") {
                        var ct = inEvent.changedTouches[0];
                        ev = {
                            target: inEvent.target,
                            clientX: ct.clientX,
                            clientY: ct.clientY,
                            path: inEvent.path
                        }
                    }
                    var nodes = inEvent.path || scope.targetFinding.path(ev);
                    for (var i = 0, n; i < nodes.length; i++) {
                        n = nodes[i];
                        this.addGestureDependency(n, currentGestures)
                    }
                } else {
                    this.addGestureDependency(inEvent.currentTarget, currentGestures)
                }
            }
            if (inEvent._handledByPG) {
                return
            }
            var fn = this.eventMap && this.eventMap[type];
            if (fn) {
                fn(inEvent)
            }
            inEvent._handledByPG = true
        },
        listen: function(target, events) {
            for (var i = 0, l = events.length, e; i < l && (e = events[i]); i++) {
                this.addEvent(target, e)
            }
        },
        unlisten: function(target, events) {
            for (var i = 0, l = events.length, e; i < l && (e = events[i]); i++) {
                this.removeEvent(target, e)
            }
        },
        addEvent: function(target, eventName) {
            target.addEventListener(eventName, this.boundHandler)
        },
        removeEvent: function(target, eventName) {
            target.removeEventListener(eventName, this.boundHandler)
        },
        makeEvent: function(inType, inEvent) {
            var e = eventFactory.makePointerEvent(inType, inEvent);
            e.preventDefault = inEvent.preventDefault;
            e.tapPrevented = inEvent.tapPrevented;
            e._target = e._target || inEvent.target;
            return e
        },
        fireEvent: function(inType, inEvent) {
            var e = this.makeEvent(inType, inEvent);
            return this.dispatchEvent(e)
        },
        cloneEvent: function(inEvent) {
            var eventCopy = Object.create(null ), p;
            for (var i = 0; i < CLONE_PROPS.length; i++) {
                p = CLONE_PROPS[i];
                eventCopy[p] = inEvent[p] || CLONE_DEFAULTS[i];
                if (p === "target" || p === "relatedTarget") {
                    if (HAS_SVG_INSTANCE && eventCopy[p] instanceof SVGElementInstance) {
                        eventCopy[p] = eventCopy[p].correspondingUseElement
                    }
                }
            }
            eventCopy.preventDefault = function() {
                inEvent.preventDefault()
            }
            ;
            return eventCopy
        },
        dispatchEvent: function(inEvent) {
            var t = inEvent._target;
            if (t) {
                t.dispatchEvent(inEvent);
                var clone = this.cloneEvent(inEvent);
                clone.target = t;
                this.fillGestureQueue(clone)
            }
        },
        gestureTrigger: function() {
            for (var i = 0, e, rg; i < this.gestureQueue.length; i++) {
                e = this.gestureQueue[i];
                rg = e._requiredGestures;
                if (rg) {
                    for (var j = 0, g, fn; j < this.gestures.length; j++) {
                        if (rg[j]) {
                            g = this.gestures[j];
                            fn = g[e.type];
                            if (fn) {
                                fn.call(g, e)
                            }
                        }
                    }
                }
            }
            this.gestureQueue.length = 0
        },
        fillGestureQueue: function(ev) {
            if (!this.gestureQueue.length) {
                requestAnimationFrame(this.boundGestureTrigger)
            }
            ev._requiredGestures = this.requiredGestures.get(ev.pointerId);
            this.gestureQueue.push(ev)
        }
    };
    dispatcher.boundHandler = dispatcher.eventHandler.bind(dispatcher);
    dispatcher.boundGestureTrigger = dispatcher.gestureTrigger.bind(dispatcher);
    scope.dispatcher = dispatcher;
    scope.activateGesture = function(node, gesture) {
        var g = gesture.toLowerCase();
        var dep = dispatcher.dependencyMap[g];
        if (dep) {
            var recognizer = dispatcher.gestures[dep.index];
            if (!node._pgListeners) {
                dispatcher.register(node);
                node._pgListeners = 0
            }
            if (recognizer) {
                var touchAction = recognizer.defaultActions && recognizer.defaultActions[g];
                var actionNode;
                switch (node.nodeType) {
                case Node.ELEMENT_NODE:
                    actionNode = node;
                    break;
                case Node.DOCUMENT_FRAGMENT_NODE:
                    actionNode = node.host;
                    break;
                default:
                    actionNode = null ;
                    break
                }
                if (touchAction && actionNode && !actionNode.hasAttribute("touch-action")) {
                    actionNode.setAttribute("touch-action", touchAction)
                }
            }
            if (!node._pgEvents) {
                node._pgEvents = {}
            }
            node._pgEvents[g] = (node._pgEvents[g] || 0) + 1;
            node._pgListeners++
        }
        return Boolean(dep)
    }
    ;
    scope.addEventListener = function(node, gesture, handler, capture) {
        if (handler) {
            scope.activateGesture(node, gesture);
            node.addEventListener(gesture, handler, capture)
        }
    }
    ;
    scope.deactivateGesture = function(node, gesture) {
        var g = gesture.toLowerCase();
        var dep = dispatcher.dependencyMap[g];
        if (dep) {
            if (node._pgListeners > 0) {
                node._pgListeners--
            }
            if (node._pgListeners === 0) {
                dispatcher.unregister(node)
            }
            if (node._pgEvents) {
                if (node._pgEvents[g] > 0) {
                    node._pgEvents[g]--
                } else {
                    node._pgEvents[g] = 0
                }
            }
        }
        return Boolean(dep)
    }
    ;
    scope.removeEventListener = function(node, gesture, handler, capture) {
        if (handler) {
            scope.deactivateGesture(node, gesture);
            node.removeEventListener(gesture, handler, capture)
        }
    }
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var pointermap = dispatcher.pointermap;
    var DEDUP_DIST = 25;
    var WHICH_TO_BUTTONS = [0, 1, 4, 2];
    var currentButtons = 0;
    var FIREFOX_LINUX = /Linux.*Firefox\//i;
    var HAS_BUTTONS = function() {
        if (FIREFOX_LINUX.test(navigator.userAgent)) {
            return false
        }
        try {
            return new MouseEvent("test",{
                buttons: 1
            }).buttons === 1
        } catch (e) {
            return false
        }
    }
    ();
    var mouseEvents = {
        POINTER_ID: 1,
        POINTER_TYPE: "mouse",
        events: ["mousedown", "mousemove", "mouseup"],
        exposes: ["down", "up", "move"],
        register: function(target) {
            dispatcher.listen(target, this.events)
        },
        unregister: function(target) {
            if (target.nodeType === Node.DOCUMENT_NODE) {
                return
            }
            dispatcher.unlisten(target, this.events)
        },
        lastTouches: [],
        isEventSimulatedFromTouch: function(inEvent) {
            var lts = this.lastTouches;
            var x = inEvent.clientX
              , y = inEvent.clientY;
            for (var i = 0, l = lts.length, t; i < l && (t = lts[i]); i++) {
                var dx = Math.abs(x - t.x)
                  , dy = Math.abs(y - t.y);
                if (dx <= DEDUP_DIST && dy <= DEDUP_DIST) {
                    return true
                }
            }
        },
        prepareEvent: function(inEvent) {
            var e = dispatcher.cloneEvent(inEvent);
            e.pointerId = this.POINTER_ID;
            e.isPrimary = true;
            e.pointerType = this.POINTER_TYPE;
            e._source = "mouse";
            if (!HAS_BUTTONS) {
                var type = inEvent.type;
                var bit = WHICH_TO_BUTTONS[inEvent.which] || 0;
                if (type === "mousedown") {
                    currentButtons |= bit
                } else if (type === "mouseup") {
                    currentButtons &= ~bit
                }
                e.buttons = currentButtons
            }
            return e
        },
        mousedown: function(inEvent) {
            if (!this.isEventSimulatedFromTouch(inEvent)) {
                var p = pointermap.has(this.POINTER_ID);
                var e = this.prepareEvent(inEvent);
                e.target = scope.findTarget(inEvent);
                pointermap.set(this.POINTER_ID, e.target);
                dispatcher.down(e)
            }
        },
        mousemove: function(inEvent) {
            if (!this.isEventSimulatedFromTouch(inEvent)) {
                var target = pointermap.get(this.POINTER_ID);
                if (target) {
                    var e = this.prepareEvent(inEvent);
                    e.target = target;
                    if ((HAS_BUTTONS ? e.buttons : e.which) === 0) {
                        if (!HAS_BUTTONS) {
                            currentButtons = e.buttons = 0
                        }
                        dispatcher.cancel(e);
                        this.cleanupMouse(e.buttons)
                    } else {
                        dispatcher.move(e)
                    }
                }
            }
        },
        mouseup: function(inEvent) {
            if (!this.isEventSimulatedFromTouch(inEvent)) {
                var e = this.prepareEvent(inEvent);
                e.relatedTarget = scope.findTarget(inEvent);
                e.target = pointermap.get(this.POINTER_ID);
                dispatcher.up(e);
                this.cleanupMouse(e.buttons)
            }
        },
        cleanupMouse: function(buttons) {
            if (buttons === 0) {
                pointermap.delete(this.POINTER_ID)
            }
        }
    };
    scope.mouseEvents = mouseEvents
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var allShadows = scope.targetFinding.allShadows.bind(scope.targetFinding);
    var pointermap = dispatcher.pointermap;
    var touchMap = Array.prototype.map.call.bind(Array.prototype.map);
    var DEDUP_TIMEOUT = 2500;
    var DEDUP_DIST = 25;
    var CLICK_COUNT_TIMEOUT = 200;
    var HYSTERESIS = 20;
    var ATTRIB = "touch-action";
    var HAS_TOUCH_ACTION = false;
    var touchEvents = {
        IS_IOS: false,
        events: ["touchstart", "touchmove", "touchend", "touchcancel"],
        exposes: ["down", "up", "move"],
        register: function(target, initial) {
            if (this.IS_IOS ? initial : !initial) {
                dispatcher.listen(target, this.events)
            }
        },
        unregister: function(target) {
            if (!this.IS_IOS) {
                dispatcher.unlisten(target, this.events)
            }
        },
        scrollTypes: {
            EMITTER: "none",
            XSCROLLER: "pan-x",
            YSCROLLER: "pan-y"
        },
        touchActionToScrollType: function(touchAction) {
            var t = touchAction;
            var st = this.scrollTypes;
            if (t === st.EMITTER) {
                return "none"
            } else if (t === st.XSCROLLER) {
                return "X"
            } else if (t === st.YSCROLLER) {
                return "Y"
            } else {
                return "XY"
            }
        },
        POINTER_TYPE: "touch",
        firstTouch: null ,
        isPrimaryTouch: function(inTouch) {
            return this.firstTouch === inTouch.identifier
        },
        setPrimaryTouch: function(inTouch) {
            if (pointermap.pointers() === 0 || pointermap.pointers() === 1 && pointermap.has(1)) {
                this.firstTouch = inTouch.identifier;
                this.firstXY = {
                    X: inTouch.clientX,
                    Y: inTouch.clientY
                };
                this.firstTarget = inTouch.target;
                this.scrolling = null ;
                this.cancelResetClickCount()
            }
        },
        removePrimaryPointer: function(inPointer) {
            if (inPointer.isPrimary) {
                this.firstTouch = null ;
                this.firstXY = null ;
                this.resetClickCount()
            }
        },
        clickCount: 0,
        resetId: null ,
        resetClickCount: function() {
            var fn = function() {
                this.clickCount = 0;
                this.resetId = null 
            }
            .bind(this);
            this.resetId = setTimeout(fn, CLICK_COUNT_TIMEOUT)
        },
        cancelResetClickCount: function() {
            if (this.resetId) {
                clearTimeout(this.resetId)
            }
        },
        typeToButtons: function(type) {
            var ret = 0;
            if (type === "touchstart" || type === "touchmove") {
                ret = 1
            }
            return ret
        },
        findTarget: function(touch, id) {
            if (this.currentTouchEvent.type === "touchstart") {
                if (this.isPrimaryTouch(touch)) {
                    var fastPath = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        path: this.currentTouchEvent.path,
                        target: this.currentTouchEvent.target
                    };
                    return scope.findTarget(fastPath)
                } else {
                    return scope.findTarget(touch)
                }
            }
            return pointermap.get(id)
        },
        touchToPointer: function(inTouch) {
            var cte = this.currentTouchEvent;
            var e = dispatcher.cloneEvent(inTouch);
            var id = e.pointerId = inTouch.identifier + 2;
            e.target = this.findTarget(inTouch, id);
            e.bubbles = true;
            e.cancelable = true;
            e.detail = this.clickCount;
            e.buttons = this.typeToButtons(cte.type);
            e.width = inTouch.webkitRadiusX || inTouch.radiusX || 0;
            e.height = inTouch.webkitRadiusY || inTouch.radiusY || 0;
            e.pressure = inTouch.webkitForce || inTouch.force || .5;
            e.isPrimary = this.isPrimaryTouch(inTouch);
            e.pointerType = this.POINTER_TYPE;
            e._source = "touch";
            var self = this;
            e.preventDefault = function() {
                self.scrolling = false;
                self.firstXY = null ;
                cte.preventDefault()
            }
            ;
            return e
        },
        processTouches: function(inEvent, inFunction) {
            var tl = inEvent.changedTouches;
            this.currentTouchEvent = inEvent;
            for (var i = 0, t, p; i < tl.length; i++) {
                t = tl[i];
                p = this.touchToPointer(t);
                if (inEvent.type === "touchstart") {
                    pointermap.set(p.pointerId, p.target)
                }
                if (pointermap.has(p.pointerId)) {
                    inFunction.call(this, p)
                }
                if (inEvent.type === "touchend" || inEvent._cancel) {
                    this.cleanUpPointer(p)
                }
            }
        },
        shouldScroll: function(inEvent) {
            if (this.firstXY) {
                var ret;
                var touchAction = scope.targetFinding.findTouchAction(inEvent);
                var scrollAxis = this.touchActionToScrollType(touchAction);
                if (scrollAxis === "none") {
                    ret = false
                } else if (scrollAxis === "XY") {
                    ret = true
                } else {
                    var t = inEvent.changedTouches[0];
                    var a = scrollAxis;
                    var oa = scrollAxis === "Y" ? "X" : "Y";
                    var da = Math.abs(t["client" + a] - this.firstXY[a]);
                    var doa = Math.abs(t["client" + oa] - this.firstXY[oa]);
                    ret = da >= doa
                }
                return ret
            }
        },
        findTouch: function(inTL, inId) {
            for (var i = 0, l = inTL.length, t; i < l && (t = inTL[i]); i++) {
                if (t.identifier === inId) {
                    return true
                }
            }
        },
        vacuumTouches: function(inEvent) {
            var tl = inEvent.touches;
            if (pointermap.pointers() >= tl.length) {
                var d = [];
                pointermap.forEach(function(value, key) {
                    if (key !== 1 && !this.findTouch(tl, key - 2)) {
                        var p = value;
                        d.push(p)
                    }
                }
                , this);
                d.forEach(function(p) {
                    this.cancel(p);
                    pointermap.delete(p.pointerId)
                }
                , this)
            }
        },
        touchstart: function(inEvent) {
            this.vacuumTouches(inEvent);
            this.setPrimaryTouch(inEvent.changedTouches[0]);
            this.dedupSynthMouse(inEvent);
            if (!this.scrolling) {
                this.clickCount++;
                this.processTouches(inEvent, this.down)
            }
        },
        down: function(inPointer) {
            dispatcher.down(inPointer)
        },
        touchmove: function(inEvent) {
            if (HAS_TOUCH_ACTION) {
                if (inEvent.cancelable) {
                    this.processTouches(inEvent, this.move)
                }
            } else {
                if (!this.scrolling) {
                    if (this.scrolling === null  && this.shouldScroll(inEvent)) {
                        this.scrolling = true
                    } else {
                        this.scrolling = false;
                        inEvent.preventDefault();
                        this.processTouches(inEvent, this.move)
                    }
                } else if (this.firstXY) {
                    var t = inEvent.changedTouches[0];
                    var dx = t.clientX - this.firstXY.X;
                    var dy = t.clientY - this.firstXY.Y;
                    var dd = Math.sqrt(dx * dx + dy * dy);
                    if (dd >= HYSTERESIS) {
                        this.touchcancel(inEvent);
                        this.scrolling = true;
                        this.firstXY = null 
                    }
                }
            }
        },
        move: function(inPointer) {
            dispatcher.move(inPointer)
        },
        touchend: function(inEvent) {
            this.dedupSynthMouse(inEvent);
            this.processTouches(inEvent, this.up)
        },
        up: function(inPointer) {
            inPointer.relatedTarget = scope.findTarget(inPointer);
            dispatcher.up(inPointer)
        },
        cancel: function(inPointer) {
            dispatcher.cancel(inPointer)
        },
        touchcancel: function(inEvent) {
            inEvent._cancel = true;
            this.processTouches(inEvent, this.cancel)
        },
        cleanUpPointer: function(inPointer) {
            pointermap["delete"](inPointer.pointerId);
            this.removePrimaryPointer(inPointer)
        },
        dedupSynthMouse: function(inEvent) {
            var lts = scope.mouseEvents.lastTouches;
            var t = inEvent.changedTouches[0];
            if (this.isPrimaryTouch(t)) {
                var lt = {
                    x: t.clientX,
                    y: t.clientY
                };
                lts.push(lt);
                var fn = function(lts, lt) {
                    var i = lts.indexOf(lt);
                    if (i > -1) {
                        lts.splice(i, 1)
                    }
                }
                .bind(null , lts, lt);
                setTimeout(fn, DEDUP_TIMEOUT)
            }
        }
    };
    var STOP_PROP_FN = Event.prototype.stopImmediatePropagation || Event.prototype.stopPropagation;
    document.addEventListener("click", function(ev) {
        var x = ev.clientX
          , y = ev.clientY;
        var closeTo = function(touch) {
            var dx = Math.abs(x - touch.x)
              , dy = Math.abs(y - touch.y);
            return dx <= DEDUP_DIST && dy <= DEDUP_DIST
        }
        ;
        var wasTouched = scope.mouseEvents.lastTouches.some(closeTo);
        var path = scope.targetFinding.path(ev);
        if (wasTouched) {
            for (var i = 0; i < path.length; i++) {
                if (path[i] === touchEvents.firstTarget) {
                    return
                }
            }
            ev.preventDefault();
            STOP_PROP_FN.call(ev)
        }
    }
    , true);
    scope.touchEvents = touchEvents
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var pointermap = dispatcher.pointermap;
    var HAS_BITMAP_TYPE = window.MSPointerEvent && typeof window.MSPointerEvent.MSPOINTER_TYPE_MOUSE === "number";
    var msEvents = {
        events: ["MSPointerDown", "MSPointerMove", "MSPointerUp", "MSPointerCancel"],
        register: function(target) {
            dispatcher.listen(target, this.events)
        },
        unregister: function(target) {
            if (target.nodeType === Node.DOCUMENT_NODE) {
                return
            }
            dispatcher.unlisten(target, this.events)
        },
        POINTER_TYPES: ["", "unavailable", "touch", "pen", "mouse"],
        prepareEvent: function(inEvent) {
            var e = inEvent;
            e = dispatcher.cloneEvent(inEvent);
            if (HAS_BITMAP_TYPE) {
                e.pointerType = this.POINTER_TYPES[inEvent.pointerType]
            }
            e._source = "ms";
            return e
        },
        cleanup: function(id) {
            pointermap["delete"](id)
        },
        MSPointerDown: function(inEvent) {
            var e = this.prepareEvent(inEvent);
            e.target = scope.findTarget(inEvent);
            pointermap.set(inEvent.pointerId, e.target);
            dispatcher.down(e)
        },
        MSPointerMove: function(inEvent) {
            var target = pointermap.get(inEvent.pointerId);
            if (target) {
                var e = this.prepareEvent(inEvent);
                e.target = target;
                dispatcher.move(e)
            }
        },
        MSPointerUp: function(inEvent) {
            var e = this.prepareEvent(inEvent);
            e.relatedTarget = scope.findTarget(inEvent);
            e.target = pointermap.get(e.pointerId);
            dispatcher.up(e);
            this.cleanup(inEvent.pointerId)
        },
        MSPointerCancel: function(inEvent) {
            var e = this.prepareEvent(inEvent);
            e.relatedTarget = scope.findTarget(inEvent);
            e.target = pointermap.get(e.pointerId);
            dispatcher.cancel(e);
            this.cleanup(inEvent.pointerId)
        }
    };
    scope.msEvents = msEvents
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var pointermap = dispatcher.pointermap;
    var pointerEvents = {
        events: ["pointerdown", "pointermove", "pointerup", "pointercancel"],
        prepareEvent: function(inEvent) {
            var e = dispatcher.cloneEvent(inEvent);
            e._source = "pointer";
            return e
        },
        register: function(target) {
            dispatcher.listen(target, this.events)
        },
        unregister: function(target) {
            if (target.nodeType === Node.DOCUMENT_NODE) {
                return
            }
            dispatcher.unlisten(target, this.events)
        },
        cleanup: function(id) {
            pointermap["delete"](id)
        },
        pointerdown: function(inEvent) {
            var e = this.prepareEvent(inEvent);
            e.target = scope.findTarget(inEvent);
            pointermap.set(e.pointerId, e.target);
            dispatcher.down(e)
        },
        pointermove: function(inEvent) {
            var target = pointermap.get(inEvent.pointerId);
            if (target) {
                var e = this.prepareEvent(inEvent);
                e.target = target;
                dispatcher.move(e)
            }
        },
        pointerup: function(inEvent) {
            var e = this.prepareEvent(inEvent);
            e.relatedTarget = scope.findTarget(inEvent);
            e.target = pointermap.get(e.pointerId);
            dispatcher.up(e);
            this.cleanup(inEvent.pointerId)
        },
        pointercancel: function(inEvent) {
            var e = this.prepareEvent(inEvent);
            e.relatedTarget = scope.findTarget(inEvent);
            e.target = pointermap.get(e.pointerId);
            dispatcher.cancel(e);
            this.cleanup(inEvent.pointerId)
        }
    };
    scope.pointerEvents = pointerEvents
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var nav = window.navigator;
    if (window.PointerEvent) {
        dispatcher.registerSource("pointer", scope.pointerEvents)
    } else if (nav.msPointerEnabled) {
        dispatcher.registerSource("ms", scope.msEvents)
    } else {
        dispatcher.registerSource("mouse", scope.mouseEvents);
        if (window.ontouchstart !== undefined) {
            dispatcher.registerSource("touch", scope.touchEvents)
        }
    }
    var ua = navigator.userAgent;
    var IS_IOS = ua.match(/iPad|iPhone|iPod/) && "ontouchstart" in window;
    dispatcher.IS_IOS = IS_IOS;
    scope.touchEvents.IS_IOS = IS_IOS;
    dispatcher.register(document, true)
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var eventFactory = scope.eventFactory;
    var pointermap = new scope.PointerMap;
    var track = {
        events: ["down", "move", "up"],
        exposes: ["trackstart", "track", "trackx", "tracky", "trackend"],
        defaultActions: {
            track: "none",
            trackx: "pan-y",
            tracky: "pan-x"
        },
        WIGGLE_THRESHOLD: 4,
        clampDir: function(inDelta) {
            return inDelta > 0 ? 1 : -1
        },
        calcPositionDelta: function(inA, inB) {
            var x = 0
              , y = 0;
            if (inA && inB) {
                x = inB.pageX - inA.pageX;
                y = inB.pageY - inA.pageY
            }
            return {
                x: x,
                y: y
            }
        },
        fireTrack: function(inType, inEvent, inTrackingData) {
            var t = inTrackingData;
            var d = this.calcPositionDelta(t.downEvent, inEvent);
            var dd = this.calcPositionDelta(t.lastMoveEvent, inEvent);
            if (dd.x) {
                t.xDirection = this.clampDir(dd.x)
            } else if (inType === "trackx") {
                return
            }
            if (dd.y) {
                t.yDirection = this.clampDir(dd.y)
            } else if (inType === "tracky") {
                return
            }
            var gestureProto = {
                bubbles: true,
                cancelable: true,
                trackInfo: t.trackInfo,
                relatedTarget: inEvent.relatedTarget,
                pointerType: inEvent.pointerType,
                pointerId: inEvent.pointerId,
                _source: "track"
            };
            if (inType !== "tracky") {
                gestureProto.x = inEvent.x;
                gestureProto.dx = d.x;
                gestureProto.ddx = dd.x;
                gestureProto.clientX = inEvent.clientX;
                gestureProto.pageX = inEvent.pageX;
                gestureProto.screenX = inEvent.screenX;
                gestureProto.xDirection = t.xDirection
            }
            if (inType !== "trackx") {
                gestureProto.dy = d.y;
                gestureProto.ddy = dd.y;
                gestureProto.y = inEvent.y;
                gestureProto.clientY = inEvent.clientY;
                gestureProto.pageY = inEvent.pageY;
                gestureProto.screenY = inEvent.screenY;
                gestureProto.yDirection = t.yDirection
            }
            var e = eventFactory.makeGestureEvent(inType, gestureProto);
            t.downTarget.dispatchEvent(e)
        },
        down: function(inEvent) {
            if (inEvent.isPrimary && (inEvent.pointerType === "mouse" ? inEvent.buttons === 1 : true)) {
                var p = {
                    downEvent: inEvent,
                    downTarget: inEvent.target,
                    trackInfo: {},
                    lastMoveEvent: null ,
                    xDirection: 0,
                    yDirection: 0,
                    tracking: false
                };
                pointermap.set(inEvent.pointerId, p)
            }
        },
        move: function(inEvent) {
            var p = pointermap.get(inEvent.pointerId);
            if (p) {
                if (!p.tracking) {
                    var d = this.calcPositionDelta(p.downEvent, inEvent);
                    var move = d.x * d.x + d.y * d.y;
                    if (move > this.WIGGLE_THRESHOLD) {
                        p.tracking = true;
                        p.lastMoveEvent = p.downEvent;
                        this.fireTrack("trackstart", inEvent, p)
                    }
                }
                if (p.tracking) {
                    this.fireTrack("track", inEvent, p);
                    this.fireTrack("trackx", inEvent, p);
                    this.fireTrack("tracky", inEvent, p)
                }
                p.lastMoveEvent = inEvent
            }
        },
        up: function(inEvent) {
            var p = pointermap.get(inEvent.pointerId);
            if (p) {
                if (p.tracking) {
                    this.fireTrack("trackend", inEvent, p)
                }
                pointermap.delete(inEvent.pointerId)
            }
        }
    };
    dispatcher.registerGesture("track", track)
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var eventFactory = scope.eventFactory;
    var hold = {
        HOLD_DELAY: 200,
        WIGGLE_THRESHOLD: 16,
        events: ["down", "move", "up"],
        exposes: ["hold", "holdpulse", "release"],
        heldPointer: null ,
        holdJob: null ,
        pulse: function() {
            var hold = Date.now() - this.heldPointer.timeStamp;
            var type = this.held ? "holdpulse" : "hold";
            this.fireHold(type, hold);
            this.held = true
        },
        cancel: function() {
            clearInterval(this.holdJob);
            if (this.held) {
                this.fireHold("release")
            }
            this.held = false;
            this.heldPointer = null ;
            this.target = null ;
            this.holdJob = null 
        },
        down: function(inEvent) {
            if (inEvent.isPrimary && !this.heldPointer) {
                this.heldPointer = inEvent;
                this.target = inEvent.target;
                this.holdJob = setInterval(this.pulse.bind(this), this.HOLD_DELAY)
            }
        },
        up: function(inEvent) {
            if (this.heldPointer && this.heldPointer.pointerId === inEvent.pointerId) {
                this.cancel()
            }
        },
        move: function(inEvent) {
            if (this.heldPointer && this.heldPointer.pointerId === inEvent.pointerId) {
                var x = inEvent.clientX - this.heldPointer.clientX;
                var y = inEvent.clientY - this.heldPointer.clientY;
                if (x * x + y * y > this.WIGGLE_THRESHOLD) {
                    this.cancel()
                }
            }
        },
        fireHold: function(inType, inHoldTime) {
            var p = {
                bubbles: true,
                cancelable: true,
                pointerType: this.heldPointer.pointerType,
                pointerId: this.heldPointer.pointerId,
                x: this.heldPointer.clientX,
                y: this.heldPointer.clientY,
                _source: "hold"
            };
            if (inHoldTime) {
                p.holdTime = inHoldTime
            }
            var e = eventFactory.makeGestureEvent(inType, p);
            this.target.dispatchEvent(e)
        }
    };
    dispatcher.registerGesture("hold", hold)
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var eventFactory = scope.eventFactory;
    var pointermap = new scope.PointerMap;
    var tap = {
        events: ["down", "up"],
        exposes: ["tap"],
        down: function(inEvent) {
            if (inEvent.isPrimary && !inEvent.tapPrevented) {
                pointermap.set(inEvent.pointerId, {
                    target: inEvent.target,
                    buttons: inEvent.buttons,
                    x: inEvent.clientX,
                    y: inEvent.clientY
                })
            }
        },
        shouldTap: function(e, downState) {
            var tap = true;
            if (e.pointerType === "mouse") {
                tap = e.buttons ^ 1 && downState.buttons & 1
            }
            return tap && !e.tapPrevented
        },
        up: function(inEvent) {
            var start = pointermap.get(inEvent.pointerId);
            if (start && this.shouldTap(inEvent, start)) {
                var t = scope.targetFinding.LCA(start.target, inEvent.relatedTarget);
                if (t) {
                    var e = eventFactory.makeGestureEvent("tap", {
                        bubbles: true,
                        cancelable: true,
                        x: inEvent.clientX,
                        y: inEvent.clientY,
                        detail: inEvent.detail,
                        pointerType: inEvent.pointerType,
                        pointerId: inEvent.pointerId,
                        altKey: inEvent.altKey,
                        ctrlKey: inEvent.ctrlKey,
                        metaKey: inEvent.metaKey,
                        shiftKey: inEvent.shiftKey,
                        _source: "tap"
                    });
                    t.dispatchEvent(e)
                }
            }
            pointermap.delete(inEvent.pointerId)
        }
    };
    eventFactory.preventTap = function(e) {
        return function() {
            e.tapPrevented = true;
            pointermap.delete(e.pointerId)
        }
    }
    ;
    dispatcher.registerGesture("tap", tap)
}
)(window.PolymerGestures);
(function(scope) {
    var dispatcher = scope.dispatcher;
    var eventFactory = scope.eventFactory;
    var pointermap = new scope.PointerMap;
    var RAD_TO_DEG = 180 / Math.PI;
    var pinch = {
        events: ["down", "up", "move", "cancel"],
        exposes: ["pinchstart", "pinch", "pinchend", "rotate"],
        defaultActions: {
            pinch: "none",
            rotate: "none"
        },
        reference: {},
        down: function(inEvent) {
            pointermap.set(inEvent.pointerId, inEvent);
            if (pointermap.pointers() == 2) {
                var points = this.calcChord();
                var angle = this.calcAngle(points);
                this.reference = {
                    angle: angle,
                    diameter: points.diameter,
                    target: scope.targetFinding.LCA(points.a.target, points.b.target)
                };
                this.firePinch("pinchstart", points.diameter, points)
            }
        },
        up: function(inEvent) {
            var p = pointermap.get(inEvent.pointerId);
            var num = pointermap.pointers();
            if (p) {
                if (num === 2) {
                    var points = this.calcChord();
                    this.firePinch("pinchend", points.diameter, points)
                }
                pointermap.delete(inEvent.pointerId)
            }
        },
        move: function(inEvent) {
            if (pointermap.has(inEvent.pointerId)) {
                pointermap.set(inEvent.pointerId, inEvent);
                if (pointermap.pointers() > 1) {
                    this.calcPinchRotate()
                }
            }
        },
        cancel: function(inEvent) {
            this.up(inEvent)
        },
        firePinch: function(type, diameter, points) {
            var zoom = diameter / this.reference.diameter;
            var e = eventFactory.makeGestureEvent(type, {
                bubbles: true,
                cancelable: true,
                scale: zoom,
                centerX: points.center.x,
                centerY: points.center.y,
                _source: "pinch"
            });
            this.reference.target.dispatchEvent(e)
        },
        fireRotate: function(angle, points) {
            var diff = Math.round((angle - this.reference.angle) % 360);
            var e = eventFactory.makeGestureEvent("rotate", {
                bubbles: true,
                cancelable: true,
                angle: diff,
                centerX: points.center.x,
                centerY: points.center.y,
                _source: "pinch"
            });
            this.reference.target.dispatchEvent(e)
        },
        calcPinchRotate: function() {
            var points = this.calcChord();
            var diameter = points.diameter;
            var angle = this.calcAngle(points);
            if (diameter != this.reference.diameter) {
                this.firePinch("pinch", diameter, points)
            }
            if (angle != this.reference.angle) {
                this.fireRotate(angle, points)
            }
        },
        calcChord: function() {
            var pointers = [];
            pointermap.forEach(function(p) {
                pointers.push(p)
            }
            );
            var dist = 0;
            var points = {
                a: pointers[0],
                b: pointers[1]
            };
            var x, y, d;
            for (var i = 0; i < pointers.length; i++) {
                var a = pointers[i];
                for (var j = i + 1; j < pointers.length; j++) {
                    var b = pointers[j];
                    x = Math.abs(a.clientX - b.clientX);
                    y = Math.abs(a.clientY - b.clientY);
                    d = x + y;
                    if (d > dist) {
                        dist = d;
                        points = {
                            a: a,
                            b: b
                        }
                    }
                }
            }
            x = Math.abs(points.a.clientX + points.b.clientX) / 2;
            y = Math.abs(points.a.clientY + points.b.clientY) / 2;
            points.center = {
                x: x,
                y: y
            };
            points.diameter = dist;
            return points
        },
        calcAngle: function(points) {
            var x = points.a.clientX - points.b.clientX;
            var y = points.a.clientY - points.b.clientY;
            return (360 + Math.atan2(y, x) * RAD_TO_DEG) % 360
        }
    };
    dispatcher.registerGesture("pinch", pinch)
}
)(window.PolymerGestures);
(function(global) {
    "use strict";
    var Token, TokenName, Syntax, Messages, source, index, length, delegate, lookahead, state;
    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8
    };
    TokenName = {};
    TokenName[Token.BooleanLiteral] = "Boolean";
    TokenName[Token.EOF] = "<end>";
    TokenName[Token.Identifier] = "Identifier";
    TokenName[Token.Keyword] = "Keyword";
    TokenName[Token.NullLiteral] = "Null";
    TokenName[Token.NumericLiteral] = "Numeric";
    TokenName[Token.Punctuator] = "Punctuator";
    TokenName[Token.StringLiteral] = "String";
    Syntax = {
        ArrayExpression: "ArrayExpression",
        BinaryExpression: "BinaryExpression",
        CallExpression: "CallExpression",
        ConditionalExpression: "ConditionalExpression",
        EmptyStatement: "EmptyStatement",
        ExpressionStatement: "ExpressionStatement",
        Identifier: "Identifier",
        Literal: "Literal",
        LabeledStatement: "LabeledStatement",
        LogicalExpression: "LogicalExpression",
        MemberExpression: "MemberExpression",
        ObjectExpression: "ObjectExpression",
        Program: "Program",
        Property: "Property",
        ThisExpression: "ThisExpression",
        UnaryExpression: "UnaryExpression"
    };
    Messages = {
        UnexpectedToken: "Unexpected token %0",
        UnknownLabel: "Undefined label '%0'",
        Redeclaration: "%0 '%1' has already been declared"
    };
    function assert(condition, message) {
        if (!condition) {
            throw new Error("ASSERT: " + message)
        }
    }
    function isDecimalDigit(ch) {
        return ch >= 48 && ch <= 57
    }
    function isWhiteSpace(ch) {
        return ch === 32 || ch === 9 || ch === 11 || ch === 12 || ch === 160 || ch >= 5760 && " ᠎             　﻿".indexOf(String.fromCharCode(ch)) > 0
    }
    function isLineTerminator(ch) {
        return ch === 10 || ch === 13 || ch === 8232 || ch === 8233
    }
    function isIdentifierStart(ch) {
        return ch === 36 || ch === 95 || ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122
    }
    function isIdentifierPart(ch) {
        return ch === 36 || ch === 95 || ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch >= 48 && ch <= 57
    }
    function isKeyword(id) {
        return id === "this"
    }
    function skipWhitespace() {
        while (index < length && isWhiteSpace(source.charCodeAt(index))) {
            ++index
        }
    }
    function getIdentifier() {
        var start, ch;
        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (isIdentifierPart(ch)) {
                ++index
            } else {
                break
            }
        }
        return source.slice(start, index)
    }
    function scanIdentifier() {
        var start, id, type;
        start = index;
        id = getIdentifier();
        if (id.length === 1) {
            type = Token.Identifier
        } else if (isKeyword(id)) {
            type = Token.Keyword
        } else if (id === "null") {
            type = Token.NullLiteral
        } else if (id === "true" || id === "false") {
            type = Token.BooleanLiteral
        } else {
            type = Token.Identifier
        }
        return {
            type: type,
            value: id,
            range: [start, index]
        }
    }
    function scanPunctuator() {
        var start = index, code = source.charCodeAt(index), code2, ch1 = source[index], ch2;
        switch (code) {
        case 46:
        case 40:
        case 41:
        case 59:
        case 44:
        case 123:
        case 125:
        case 91:
        case 93:
        case 58:
        case 63:
            ++index;
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                range: [start, index]
            };
        default:
            code2 = source.charCodeAt(index + 1);
            if (code2 === 61) {
                switch (code) {
                case 37:
                case 38:
                case 42:
                case 43:
                case 45:
                case 47:
                case 60:
                case 62:
                case 124:
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        range: [start, index]
                    };
                case 33:
                case 61:
                    index += 2;
                    if (source.charCodeAt(index) === 61) {
                        ++index
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        range: [start, index]
                    };
                default:
                    break
                }
            }
            break
        }
        ch2 = source[index + 1];
        if (ch1 === ch2 && "&|".indexOf(ch1) >= 0) {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch1 + ch2,
                range: [start, index]
            }
        }
        if ("<>=!+-*%&|^/".indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                range: [start, index]
            }
        }
        throwError({}, Messages.UnexpectedToken, "ILLEGAL")
    }
    function scanNumericLiteral() {
        var number, start, ch;
        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || ch === ".", "Numeric literal must start with a decimal digit or a decimal point");
        start = index;
        number = "";
        if (ch !== ".") {
            number = source[index++];
            ch = source[index];
            if (number === "0") {
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, "ILLEGAL")
                }
            }
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++]
            }
            ch = source[index]
        }
        if (ch === ".") {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++]
            }
            ch = source[index]
        }
        if (ch === "e" || ch === "E") {
            number += source[index++];
            ch = source[index];
            if (ch === "+" || ch === "-") {
                number += source[index++]
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++]
                }
            } else {
                throwError({}, Messages.UnexpectedToken, "ILLEGAL")
            }
        }
        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, "ILLEGAL")
        }
        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            range: [start, index]
        }
    }
    function scanStringLiteral() {
        var str = "", quote, start, ch, octal = false;
        quote = source[index];
        assert(quote === "'" || quote === '"', "String literal must starts with a quote");
        start = index;
        ++index;
        while (index < length) {
            ch = source[index++];
            if (ch === quote) {
                quote = "";
                break
            } else if (ch === "\\") {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case "n":
                        str += "\n";
                        break;
                    case "r":
                        str += "\r";
                        break;
                    case "t":
                        str += "	";
                        break;
                    case "b":
                        str += "\b";
                        break;
                    case "f":
                        str += "\f";
                        break;
                    case "v":
                        str += "";
                        break;
                    default:
                        str += ch;
                        break
                    }
                } else {
                    if (ch === "\r" && source[index] === "\n") {
                        ++index
                    }
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break
            } else {
                str += ch
            }
        }
        if (quote !== "") {
            throwError({}, Messages.UnexpectedToken, "ILLEGAL")
        }
        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            range: [start, index]
        }
    }
    function isIdentifierName(token) {
        return token.type === Token.Identifier || token.type === Token.Keyword || token.type === Token.BooleanLiteral || token.type === Token.NullLiteral
    }
    function advance() {
        var ch;
        skipWhitespace();
        if (index >= length) {
            return {
                type: Token.EOF,
                range: [index, index]
            }
        }
        ch = source.charCodeAt(index);
        if (ch === 40 || ch === 41 || ch === 58) {
            return scanPunctuator()
        }
        if (ch === 39 || ch === 34) {
            return scanStringLiteral()
        }
        if (isIdentifierStart(ch)) {
            return scanIdentifier()
        }
        if (ch === 46) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral()
            }
            return scanPunctuator()
        }
        if (isDecimalDigit(ch)) {
            return scanNumericLiteral()
        }
        return scanPunctuator()
    }
    function lex() {
        var token;
        token = lookahead;
        index = token.range[1];
        lookahead = advance();
        index = token.range[1];
        return token
    }
    function peek() {
        var pos;
        pos = index;
        lookahead = advance();
        index = pos
    }
    function throwError(token, messageFormat) {
        var error, args = Array.prototype.slice.call(arguments, 2), msg = messageFormat.replace(/%(\d)/g, function(whole, index) {
            assert(index < args.length, "Message reference must be in range");
            return args[index]
        }
        );
        error = new Error(msg);
        error.index = index;
        error.description = msg;
        throw error
    }
    function throwUnexpected(token) {
        throwError(token, Messages.UnexpectedToken, token.value)
    }
    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token)
        }
    }
    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value
    }
    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword
    }
    function consumeSemicolon() {
        if (source.charCodeAt(index) === 59) {
            lex();
            return
        }
        skipWhitespace();
        if (match(";")) {
            lex();
            return
        }
        if (lookahead.type !== Token.EOF && !match("}")) {
            throwUnexpected(lookahead)
        }
    }
    function parseArrayInitialiser() {
        var elements = [];
        expect("[");
        while (!match("]")) {
            if (match(",")) {
                lex();
                elements.push(null )
            } else {
                elements.push(parseExpression());
                if (!match("]")) {
                    expect(",")
                }
            }
        }
        expect("]");
        return delegate.createArrayExpression(elements)
    }
    function parseObjectPropertyKey() {
        var token;
        skipWhitespace();
        token = lex();
        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            return delegate.createLiteral(token)
        }
        return delegate.createIdentifier(token.value)
    }
    function parseObjectProperty() {
        var token, key;
        token = lookahead;
        skipWhitespace();
        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token)
        }
        key = parseObjectPropertyKey();
        expect(":");
        return delegate.createProperty("init", key, parseExpression())
    }
    function parseObjectInitialiser() {
        var properties = [];
        expect("{");
        while (!match("}")) {
            properties.push(parseObjectProperty());
            if (!match("}")) {
                expect(",")
            }
        }
        expect("}");
        return delegate.createObjectExpression(properties)
    }
    function parseGroupExpression() {
        var expr;
        expect("(");
        expr = parseExpression();
        expect(")");
        return expr
    }
    function parsePrimaryExpression() {
        var type, token, expr;
        if (match("(")) {
            return parseGroupExpression()
        }
        type = lookahead.type;
        if (type === Token.Identifier) {
            expr = delegate.createIdentifier(lex().value)
        } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            expr = delegate.createLiteral(lex())
        } else if (type === Token.Keyword) {
            if (matchKeyword("this")) {
                lex();
                expr = delegate.createThisExpression()
            }
        } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = token.value === "true";
            expr = delegate.createLiteral(token)
        } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null ;
            expr = delegate.createLiteral(token)
        } else if (match("[")) {
            expr = parseArrayInitialiser()
        } else if (match("{")) {
            expr = parseObjectInitialiser()
        }
        if (expr) {
            return expr
        }
        throwUnexpected(lex())
    }
    function parseArguments() {
        var args = [];
        expect("(");
        if (!match(")")) {
            while (index < length) {
                args.push(parseExpression());
                if (match(")")) {
                    break
                }
                expect(",")
            }
        }
        expect(")");
        return args
    }
    function parseNonComputedProperty() {
        var token;
        token = lex();
        if (!isIdentifierName(token)) {
            throwUnexpected(token)
        }
        return delegate.createIdentifier(token.value)
    }
    function parseNonComputedMember() {
        expect(".");
        return parseNonComputedProperty()
    }
    function parseComputedMember() {
        var expr;
        expect("[");
        expr = parseExpression();
        expect("]");
        return expr
    }
    function parseLeftHandSideExpression() {
        var expr, args, property;
        expr = parsePrimaryExpression();
        while (true) {
            if (match("[")) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression("[", expr, property)
            } else if (match(".")) {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression(".", expr, property)
            } else if (match("(")) {
                args = parseArguments();
                expr = delegate.createCallExpression(expr, args)
            } else {
                break
            }
        }
        return expr
    }
    var parsePostfixExpression = parseLeftHandSideExpression;
    function parseUnaryExpression() {
        var token, expr;
        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression()
        } else if (match("+") || match("-") || match("!")) {
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr)
        } else if (matchKeyword("delete") || matchKeyword("void") || matchKeyword("typeof")) {
            throwError({}, Messages.UnexpectedToken)
        } else {
            expr = parsePostfixExpression()
        }
        return expr
    }
    function binaryPrecedence(token) {
        var prec = 0;
        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0
        }
        switch (token.value) {
        case "||":
            prec = 1;
            break;
        case "&&":
            prec = 2;
            break;
        case "==":
        case "!=":
        case "===":
        case "!==":
            prec = 6;
            break;
        case "<":
        case ">":
        case "<=":
        case ">=":
        case "instanceof":
            prec = 7;
            break;
        case "in":
            prec = 7;
            break;
        case "+":
        case "-":
            prec = 9;
            break;
        case "*":
        case "/":
        case "%":
            prec = 11;
            break;
        default:
            break
        }
        return prec
    }
    function parseBinaryExpression() {
        var expr, token, prec, stack, right, operator, left, i;
        left = parseUnaryExpression();
        token = lookahead;
        prec = binaryPrecedence(token);
        if (prec === 0) {
            return left
        }
        token.prec = prec;
        lex();
        right = parseUnaryExpression();
        stack = [left, token, right];
        while ((prec = binaryPrecedence(lookahead)) > 0) {
            while (stack.length > 2 && prec <= stack[stack.length - 2].prec) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                stack.push(expr)
            }
            token = lex();
            token.prec = prec;
            stack.push(token);
            expr = parseUnaryExpression();
            stack.push(expr)
        }
        i = stack.length - 1;
        expr = stack[i];
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2
        }
        return expr
    }
    function parseConditionalExpression() {
        var expr, consequent, alternate;
        expr = parseBinaryExpression();
        if (match("?")) {
            lex();
            consequent = parseConditionalExpression();
            expect(":");
            alternate = parseConditionalExpression();
            expr = delegate.createConditionalExpression(expr, consequent, alternate)
        }
        return expr
    }
    var parseExpression = parseConditionalExpression;
    function parseFilter() {
        var identifier, args;
        identifier = lex();
        if (identifier.type !== Token.Identifier) {
            throwUnexpected(identifier)
        }
        args = match("(") ? parseArguments() : [];
        return delegate.createFilter(identifier.value, args)
    }
    function parseFilters() {
        while (match("|")) {
            lex();
            parseFilter()
        }
    }
    function parseTopLevel() {
        skipWhitespace();
        peek();
        var expr = parseExpression();
        if (expr) {
            if (lookahead.value === "," || lookahead.value == "in" && expr.type === Syntax.Identifier) {
                parseInExpression(expr)
            } else {
                parseFilters();
                if (lookahead.value === "as") {
                    parseAsExpression(expr)
                } else {
                    delegate.createTopLevel(expr)
                }
            }
        }
        if (lookahead.type !== Token.EOF) {
            throwUnexpected(lookahead)
        }
    }
    function parseAsExpression(expr) {
        lex();
        var identifier = lex().value;
        delegate.createAsExpression(expr, identifier)
    }
    function parseInExpression(identifier) {
        var indexName;
        if (lookahead.value === ",") {
            lex();
            if (lookahead.type !== Token.Identifier)
                throwUnexpected(lookahead);
            indexName = lex().value
        }
        lex();
        var expr = parseExpression();
        parseFilters();
        delegate.createInExpression(identifier.name, indexName, expr)
    }
    function parse(code, inDelegate) {
        delegate = inDelegate;
        source = code;
        index = 0;
        length = source.length;
        lookahead = null ;
        state = {
            labelSet: {}
        };
        return parseTopLevel()
    }
    global.esprima = {
        parse: parse
    }
}
)(this);
(function(global) {
    "use strict";
    function prepareBinding(expressionText, name, node, filterRegistry) {
        var expression;
        try {
            expression = getExpression(expressionText);
            if (expression.scopeIdent && (node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "TEMPLATE" || name !== "bind" && name !== "repeat")) {
                throw Error("as and in can only be used within <template bind/repeat>")
            }
        } catch (ex) {
            console.error("Invalid expression syntax: " + expressionText, ex);
            return
        }
        return function(model, node, oneTime) {
            var binding = expression.getBinding(model, filterRegistry, oneTime);
            if (expression.scopeIdent && binding) {
                node.polymerExpressionScopeIdent_ = expression.scopeIdent;
                if (expression.indexIdent)
                    node.polymerExpressionIndexIdent_ = expression.indexIdent
            }
            return binding
        }
    }
    var expressionParseCache = Object.create(null );
    function getExpression(expressionText) {
        var expression = expressionParseCache[expressionText];
        if (!expression) {
            var delegate = new ASTDelegate;
            esprima.parse(expressionText, delegate);
            expression = new Expression(delegate);
            expressionParseCache[expressionText] = expression
        }
        return expression
    }
    function Literal(value) {
        this.value = value;
        this.valueFn_ = undefined
    }
    Literal.prototype = {
        valueFn: function() {
            if (!this.valueFn_) {
                var value = this.value;
                this.valueFn_ = function() {
                    return value
                }
            }
            return this.valueFn_
        }
    };
    function IdentPath(name) {
        this.name = name;
        this.path = Path.get(name)
    }
    IdentPath.prototype = {
        valueFn: function() {
            if (!this.valueFn_) {
                var name = this.name;
                var path = this.path;
                this.valueFn_ = function(model, observer) {
                    if (observer)
                        observer.addPath(model, path);
                    return path.getValueFrom(model)
                }
            }
            return this.valueFn_
        },
        setValue: function(model, newValue) {
            if (this.path.length == 1)
                model = findScope(model, this.path[0]);
            return this.path.setValueFrom(model, newValue)
        }
    };
    function MemberExpression(object, property, accessor) {
        this.computed = accessor == "[";
        this.dynamicDeps = typeof object == "function" || object.dynamicDeps || this.computed && !(property instanceof Literal);
        this.simplePath = !this.dynamicDeps && (property instanceof IdentPath || property instanceof Literal) && (object instanceof MemberExpression || object instanceof IdentPath);
        this.object = this.simplePath ? object : getFn(object);
        this.property = !this.computed || this.simplePath ? property : getFn(property)
    }
    MemberExpression.prototype = {
        get fullPath() {
            if (!this.fullPath_) {
                var parts = this.object instanceof MemberExpression ? this.object.fullPath.slice() : [this.object.name];
                parts.push(this.property instanceof IdentPath ? this.property.name : this.property.value);
                this.fullPath_ = Path.get(parts)
            }
            return this.fullPath_
        },
        valueFn: function() {
            if (!this.valueFn_) {
                var object = this.object;
                if (this.simplePath) {
                    var path = this.fullPath;
                    this.valueFn_ = function(model, observer) {
                        if (observer)
                            observer.addPath(model, path);
                        return path.getValueFrom(model)
                    }
                } else if (!this.computed) {
                    var path = Path.get(this.property.name);
                    this.valueFn_ = function(model, observer, filterRegistry) {
                        var context = object(model, observer, filterRegistry);
                        if (observer)
                            observer.addPath(context, path);
                        return path.getValueFrom(context)
                    }
                } else {
                    var property = this.property;
                    this.valueFn_ = function(model, observer, filterRegistry) {
                        var context = object(model, observer, filterRegistry);
                        var propName = property(model, observer, filterRegistry);
                        if (observer)
                            observer.addPath(context, [propName]);
                        return context ? context[propName] : undefined
                    }
                }
            }
            return this.valueFn_
        },
        setValue: function(model, newValue) {
            if (this.simplePath) {
                this.fullPath.setValueFrom(model, newValue);
                return newValue
            }
            var object = this.object(model);
            var propName = this.property instanceof IdentPath ? this.property.name : this.property(model);
            return object[propName] = newValue
        }
    };
    function Filter(name, args) {
        this.name = name;
        this.args = [];
        for (var i = 0; i < args.length; i++) {
            this.args[i] = getFn(args[i])
        }
    }
    Filter.prototype = {
        transform: function(model, observer, filterRegistry, toModelDirection, initialArgs) {
            var context = model;
            var fn = context[this.name];
            if (!fn) {
                fn = filterRegistry[this.name];
                if (!fn) {
                    console.error("Cannot find function or filter: " + this.name);
                    return
                }
            }
            if (toModelDirection) {
                fn = fn.toModel
            } else if (typeof fn.toDOM == "function") {
                fn = fn.toDOM
            }
            if (typeof fn != "function") {
                console.error("Cannot find function or filter: " + this.name);
                return
            }
            var args = initialArgs || [];
            for (var i = 0; i < this.args.length; i++) {
                args.push(getFn(this.args[i])(model, observer, filterRegistry))
            }
            return fn.apply(context, args)
        }
    };
    function notImplemented() {
        throw Error("Not Implemented")
    }
    var unaryOperators = {
        "+": function(v) {
            return +v
        },
        "-": function(v) {
            return -v
        },
        "!": function(v) {
            return !v
        }
    };
    var binaryOperators = {
        "+": function(l, r) {
            return l + r
        },
        "-": function(l, r) {
            return l - r
        },
        "*": function(l, r) {
            return l * r
        },
        "/": function(l, r) {
            return l / r
        },
        "%": function(l, r) {
            return l % r
        },
        "<": function(l, r) {
            return l < r
        },
        ">": function(l, r) {
            return l > r
        },
        "<=": function(l, r) {
            return l <= r
        },
        ">=": function(l, r) {
            return l >= r
        },
        "==": function(l, r) {
            return l == r
        },
        "!=": function(l, r) {
            return l != r
        },
        "===": function(l, r) {
            return l === r
        },
        "!==": function(l, r) {
            return l !== r
        },
        "&&": function(l, r) {
            return l && r
        },
        "||": function(l, r) {
            return l || r
        }
    };
    function getFn(arg) {
        return typeof arg == "function" ? arg : arg.valueFn()
    }
    function ASTDelegate() {
        this.expression = null ;
        this.filters = [];
        this.deps = {};
        this.currentPath = undefined;
        this.scopeIdent = undefined;
        this.indexIdent = undefined;
        this.dynamicDeps = false
    }
    ASTDelegate.prototype = {
        createUnaryExpression: function(op, argument) {
            if (!unaryOperators[op])
                throw Error("Disallowed operator: " + op);
            argument = getFn(argument);
            return function(model, observer, filterRegistry) {
                return unaryOperators[op](argument(model, observer, filterRegistry))
            }
        },
        createBinaryExpression: function(op, left, right) {
            if (!binaryOperators[op])
                throw Error("Disallowed operator: " + op);
            left = getFn(left);
            right = getFn(right);
            switch (op) {
            case "||":
                this.dynamicDeps = true;
                return function(model, observer, filterRegistry) {
                    return left(model, observer, filterRegistry) || right(model, observer, filterRegistry)
                }
                ;
            case "&&":
                this.dynamicDeps = true;
                return function(model, observer, filterRegistry) {
                    return left(model, observer, filterRegistry) && right(model, observer, filterRegistry)
                }
            }
            return function(model, observer, filterRegistry) {
                return binaryOperators[op](left(model, observer, filterRegistry), right(model, observer, filterRegistry))
            }
        },
        createConditionalExpression: function(test, consequent, alternate) {
            test = getFn(test);
            consequent = getFn(consequent);
            alternate = getFn(alternate);
            this.dynamicDeps = true;
            return function(model, observer, filterRegistry) {
                return test(model, observer, filterRegistry) ? consequent(model, observer, filterRegistry) : alternate(model, observer, filterRegistry)
            }
        },
        createIdentifier: function(name) {
            var ident = new IdentPath(name);
            ident.type = "Identifier";
            return ident
        },
        createMemberExpression: function(accessor, object, property) {
            var ex = new MemberExpression(object,property,accessor);
            if (ex.dynamicDeps)
                this.dynamicDeps = true;
            return ex
        },
        createCallExpression: function(expression, args) {
            if (!(expression instanceof IdentPath))
                throw Error("Only identifier function invocations are allowed");
            var filter = new Filter(expression.name,args);
            return function(model, observer, filterRegistry) {
                return filter.transform(model, observer, filterRegistry, false)
            }
        },
        createLiteral: function(token) {
            return new Literal(token.value)
        },
        createArrayExpression: function(elements) {
            for (var i = 0; i < elements.length; i++)
                elements[i] = getFn(elements[i]);
            return function(model, observer, filterRegistry) {
                var arr = [];
                for (var i = 0; i < elements.length; i++)
                    arr.push(elements[i](model, observer, filterRegistry));
                return arr
            }
        },
        createProperty: function(kind, key, value) {
            return {
                key: key instanceof IdentPath ? key.name : key.value,
                value: value
            }
        },
        createObjectExpression: function(properties) {
            for (var i = 0; i < properties.length; i++)
                properties[i].value = getFn(properties[i].value);
            return function(model, observer, filterRegistry) {
                var obj = {};
                for (var i = 0; i < properties.length; i++)
                    obj[properties[i].key] = properties[i].value(model, observer, filterRegistry);
                return obj
            }
        },
        createFilter: function(name, args) {
            this.filters.push(new Filter(name,args))
        },
        createAsExpression: function(expression, scopeIdent) {
            this.expression = expression;
            this.scopeIdent = scopeIdent
        },
        createInExpression: function(scopeIdent, indexIdent, expression) {
            this.expression = expression;
            this.scopeIdent = scopeIdent;
            this.indexIdent = indexIdent
        },
        createTopLevel: function(expression) {
            this.expression = expression
        },
        createThisExpression: notImplemented
    };
    function ConstantObservable(value) {
        this.value_ = value
    }
    ConstantObservable.prototype = {
        open: function() {
            return this.value_
        },
        discardChanges: function() {
            return this.value_
        },
        deliver: function() {},
        close: function() {}
    };
    function Expression(delegate) {
        this.scopeIdent = delegate.scopeIdent;
        this.indexIdent = delegate.indexIdent;
        if (!delegate.expression)
            throw Error("No expression found.");
        this.expression = delegate.expression;
        getFn(this.expression);
        this.filters = delegate.filters;
        this.dynamicDeps = delegate.dynamicDeps
    }
    Expression.prototype = {
        getBinding: function(model, filterRegistry, oneTime) {
            if (oneTime)
                return this.getValue(model, undefined, filterRegistry);
            var observer = new CompoundObserver;
            var firstValue = this.getValue(model, observer, filterRegistry);
            var firstTime = true;
            var self = this;
            function valueFn() {
                if (firstTime) {
                    firstTime = false;
                    return firstValue
                }
                if (self.dynamicDeps)
                    observer.startReset();
                var value = self.getValue(model, self.dynamicDeps ? observer : undefined, filterRegistry);
                if (self.dynamicDeps)
                    observer.finishReset();
                return value
            }
            function setValueFn(newValue) {
                self.setValue(model, newValue, filterRegistry);
                return newValue
            }
            return new ObserverTransform(observer,valueFn,setValueFn,true)
        },
        getValue: function(model, observer, filterRegistry) {
            var value = getFn(this.expression)(model, observer, filterRegistry);
            for (var i = 0; i < this.filters.length; i++) {
                value = this.filters[i].transform(model, observer, filterRegistry, false, [value])
            }
            return value
        },
        setValue: function(model, newValue, filterRegistry) {
            var count = this.filters ? this.filters.length : 0;
            while (count-- > 0) {
                newValue = this.filters[count].transform(model, undefined, filterRegistry, true, [newValue])
            }
            if (this.expression.setValue)
                return this.expression.setValue(model, newValue)
        }
    };
    function convertStylePropertyName(name) {
        return String(name).replace(/[A-Z]/g, function(c) {
            return "-" + c.toLowerCase()
        }
        )
    }
    var parentScopeName = "@" + Math.random().toString(36).slice(2);
    function findScope(model, prop) {
        while (model[parentScopeName] && !Object.prototype.hasOwnProperty.call(model, prop)) {
            model = model[parentScopeName]
        }
        return model
    }
    function isLiteralExpression(pathString) {
        switch (pathString) {
        case "":
            return false;
        case "false":
        case "null":
        case "true":
            return true
        }
        if (!isNaN(Number(pathString)))
            return true;
        return false
    }
    function PolymerExpressions() {}
    PolymerExpressions.prototype = {
        styleObject: function(value) {
            var parts = [];
            for (var key in value) {
                parts.push(convertStylePropertyName(key) + ": " + value[key])
            }
            return parts.join("; ")
        },
        tokenList: function(value) {
            var tokens = [];
            for (var key in value) {
                if (value[key])
                    tokens.push(key)
            }
            return tokens.join(" ")
        },
        prepareInstancePositionChanged: function(template) {
            var indexIdent = template.polymerExpressionIndexIdent_;
            if (!indexIdent)
                return;
            return function(templateInstance, index) {
                templateInstance.model[indexIdent] = index
            }
        },
        prepareBinding: function(pathString, name, node) {
            var path = Path.get(pathString);
            if (!isLiteralExpression(pathString) && path.valid) {
                if (path.length == 1) {
                    return function(model, node, oneTime) {
                        if (oneTime)
                            return path.getValueFrom(model);
                        var scope = findScope(model, path[0]);
                        return new PathObserver(scope,path)
                    }
                }
                return
            }
            return prepareBinding(pathString, name, node, this)
        },
        prepareInstanceModel: function(template) {
            var scopeName = template.polymerExpressionScopeIdent_;
            if (!scopeName)
                return;
            var parentScope = template.templateInstance ? template.templateInstance.model : template.model;
            var indexName = template.polymerExpressionIndexIdent_;
            return function(model) {
                return createScopeObject(parentScope, model, scopeName, indexName)
            }
        }
    };
    var createScopeObject = "__proto__" in {} ? function(parentScope, model, scopeName, indexName) {
        var scope = {};
        scope[scopeName] = model;
        scope[indexName] = undefined;
        scope[parentScopeName] = parentScope;
        scope.__proto__ = parentScope;
        return scope
    }
     : function(parentScope, model, scopeName, indexName) {
        var scope = Object.create(parentScope);
        Object.defineProperty(scope, scopeName, {
            value: model,
            configurable: true,
            writable: true
        });
        Object.defineProperty(scope, indexName, {
            value: undefined,
            configurable: true,
            writable: true
        });
        Object.defineProperty(scope, parentScopeName, {
            value: parentScope,
            configurable: true,
            writable: true
        });
        return scope
    }
    ;
    global.PolymerExpressions = PolymerExpressions;
    PolymerExpressions.getExpression = getExpression
}
)(this);
Polymer = {
    version: "0.5.5"
};
if (typeof window.Polymer === "function") {
    Polymer = {}
}
(function(scope) {
    function withDependencies(task, depends) {
        depends = depends || [];
        if (!depends.map) {
            depends = [depends]
        }
        return task.apply(this, depends.map(marshal))
    }
    function module(name, dependsOrFactory, moduleFactory) {
        var module;
        switch (arguments.length) {
        case 0:
            return;
        case 1:
            module = null ;
            break;
        case 2:
            module = dependsOrFactory.apply(this);
            break;
        default:
            module = withDependencies(moduleFactory, dependsOrFactory);
            break
        }
        modules[name] = module
    }
    function marshal(name) {
        return modules[name]
    }
    var modules = {};
    function using(depends, task) {
        HTMLImports.whenImportsReady(function() {
            withDependencies(task, depends)
        }
        )
    }
    scope.marshal = marshal;
    scope.modularize = module;
    scope.using = using
}
)(window);
if (!window.WebComponents) {
    if (!window.WebComponents) {
        WebComponents = {
            flush: function() {},
            flags: {
                log: {}
            }
        };
        Platform = WebComponents;
        CustomElements = {
            useNative: true,
            ready: true,
            takeRecords: function() {},
            "instanceof": function(obj, base) {
                return obj instanceof base
            }
        };
        HTMLImports = {
            useNative: true
        };
        addEventListener("HTMLImportsLoaded", function() {
            document.dispatchEvent(new CustomEvent("WebComponentsReady",{
                bubbles: true
            }))
        }
        );
        ShadowDOMPolyfill = null ;
        wrap = unwrap = function(n) {
            return n
        }
    }
    window.HTMLImports = window.HTMLImports || {
        flags: {}
    };
    (function(scope) {
        var IMPORT_LINK_TYPE = "import";
        var useNative = Boolean(IMPORT_LINK_TYPE in document.createElement("link"));
        var hasShadowDOMPolyfill = Boolean(window.ShadowDOMPolyfill);
        var wrap = function(node) {
            return hasShadowDOMPolyfill ? ShadowDOMPolyfill.wrapIfNeeded(node) : node
        }
        ;
        var rootDocument = wrap(document);
        var currentScriptDescriptor = {
            get: function() {
                var script = HTMLImports.currentScript || document.currentScript || (document.readyState !== "complete" ? document.scripts[document.scripts.length - 1] : null );
                return wrap(script)
            },
            configurable: true
        };
        Object.defineProperty(document, "_currentScript", currentScriptDescriptor);
        Object.defineProperty(rootDocument, "_currentScript", currentScriptDescriptor);
        var isIE = /Trident/.test(navigator.userAgent);
        function whenReady(callback, doc) {
            doc = doc || rootDocument;
            whenDocumentReady(function() {
                watchImportsLoad(callback, doc)
            }
            , doc)
        }
        var requiredReadyState = isIE ? "complete" : "interactive";
        var READY_EVENT = "readystatechange";
        function isDocumentReady(doc) {
            return doc.readyState === "complete" || doc.readyState === requiredReadyState
        }
        function whenDocumentReady(callback, doc) {
            if (!isDocumentReady(doc)) {
                var checkReady = function() {
                    if (doc.readyState === "complete" || doc.readyState === requiredReadyState) {
                        doc.removeEventListener(READY_EVENT, checkReady);
                        whenDocumentReady(callback, doc)
                    }
                }
                ;
                doc.addEventListener(READY_EVENT, checkReady)
            } else if (callback) {
                callback()
            }
        }
        function markTargetLoaded(event) {
            event.target.__loaded = true
        }
        function watchImportsLoad(callback, doc) {
            var imports = doc.querySelectorAll("link[rel=import]");
            var loaded = 0
              , l = imports.length;
            function checkDone(d) {
                if (loaded == l && callback) {
                    callback()
                }
            }
            function loadedImport(e) {
                markTargetLoaded(e);
                loaded++;
                checkDone()
            }
            if (l) {
                for (var i = 0, imp; i < l && (imp = imports[i]); i++) {
                    if (isImportLoaded(imp)) {
                        loadedImport.call(imp, {
                            target: imp
                        })
                    } else {
                        imp.addEventListener("load", loadedImport);
                        imp.addEventListener("error", loadedImport)
                    }
                }
            } else {
                checkDone()
            }
        }
        function isImportLoaded(link) {
            return useNative ? link.__loaded || link.import && link.import.readyState !== "loading" : link.__importParsed
        }
        if (useNative) {
            new MutationObserver(function(mxns) {
                for (var i = 0, l = mxns.length, m; i < l && (m = mxns[i]); i++) {
                    if (m.addedNodes) {
                        handleImports(m.addedNodes)
                    }
                }
            }
            ).observe(document.head, {
                childList: true
            });
            function handleImports(nodes) {
                for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
                    if (isImport(n)) {
                        handleImport(n)
                    }
                }
            }
            function isImport(element) {
                return element.localName === "link" && element.rel === "import"
            }
            function handleImport(element) {
                var loaded = element.import;
                if (loaded) {
                    markTargetLoaded({
                        target: element
                    })
                } else {
                    element.addEventListener("load", markTargetLoaded);
                    element.addEventListener("error", markTargetLoaded)
                }
            }
            (function() {
                if (document.readyState === "loading") {
                    var imports = document.querySelectorAll("link[rel=import]");
                    for (var i = 0, l = imports.length, imp; i < l && (imp = imports[i]); i++) {
                        handleImport(imp)
                    }
                }
            }
            )()
        }
        whenReady(function() {
            HTMLImports.ready = true;
            HTMLImports.readyTime = (new Date).getTime();
            rootDocument.dispatchEvent(new CustomEvent("HTMLImportsLoaded",{
                bubbles: true
            }))
        }
        );
        scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
        scope.useNative = useNative;
        scope.rootDocument = rootDocument;
        scope.whenReady = whenReady;
        scope.isIE = isIE
    }
    )(HTMLImports);
    (function(scope) {
        var style = document.createElement("style");
        style.textContent = "" + "body {" + "transition: opacity ease-in 0.2s;" + " } \n" + "body[unresolved] {" + "opacity: 0; display: block; overflow: hidden;" + " } \n";
        var head = document.querySelector("head");
        head.insertBefore(style, head.firstChild)
    }
    )(Platform)
}
(function(global) {
    "use strict";
    var testingExposeCycleCount = global.testingExposeCycleCount;
    function detectObjectObserve() {
        if (typeof Object.observe !== "function" || typeof Array.observe !== "function") {
            return false
        }
        var records = [];
        function callback(recs) {
            records = recs
        }
        var test = {};
        var arr = [];
        Object.observe(test, callback);
        Array.observe(arr, callback);
        test.id = 1;
        test.id = 2;
        delete test.id;
        arr.push(1, 2);
        arr.length = 0;
        Object.deliverChangeRecords(callback);
        if (records.length !== 5)
            return false;
        if (records[0].type != "add" || records[1].type != "update" || records[2].type != "delete" || records[3].type != "splice" || records[4].type != "splice") {
            return false
        }
        Object.unobserve(test, callback);
        Array.unobserve(arr, callback);
        return true
    }
    var hasObserve = detectObjectObserve();
    function detectEval() {
        if (typeof chrome !== "undefined" && chrome.app && chrome.app.runtime) {
            return false
        }
        if (typeof navigator != "undefined" && navigator.getDeviceStorage) {
            return false
        }
        try {
            var f = new Function("","return true;");
            return f()
        } catch (ex) {
            return false
        }
    }
    var hasEval = detectEval();
    function isIndex(s) {
        return +s === s >>> 0 && s !== ""
    }
    function toNumber(s) {
        return +s
    }
    function isObject(obj) {
        return obj === Object(obj)
    }
    var numberIsNaN = global.Number.isNaN || function(value) {
        return typeof value === "number" && global.isNaN(value)
    }
    ;
    function areSameValue(left, right) {
        if (left === right)
            return left !== 0 || 1 / left === 1 / right;
        if (numberIsNaN(left) && numberIsNaN(right))
            return true;
        return left !== left && right !== right
    }
    var createObject = "__proto__" in {} ? function(obj) {
        return obj
    }
     : function(obj) {
        var proto = obj.__proto__;
        if (!proto)
            return obj;
        var newObject = Object.create(proto);
        Object.getOwnPropertyNames(obj).forEach(function(name) {
            Object.defineProperty(newObject, name, Object.getOwnPropertyDescriptor(obj, name))
        }
        );
        return newObject
    }
    ;
    var identStart = "[$_a-zA-Z]";
    var identPart = "[$_a-zA-Z0-9]";
    var identRegExp = new RegExp("^" + identStart + "+" + identPart + "*" + "$");
    function getPathCharType(char) {
        if (char === undefined)
            return "eof";
        var code = char.charCodeAt(0);
        switch (code) {
        case 91:
        case 93:
        case 46:
        case 34:
        case 39:
        case 48:
            return char;
        case 95:
        case 36:
            return "ident";
        case 32:
        case 9:
        case 10:
        case 13:
        case 160:
        case 65279:
        case 8232:
        case 8233:
            return "ws"
        }
        if (97 <= code && code <= 122 || 65 <= code && code <= 90)
            return "ident";
        if (49 <= code && code <= 57)
            return "number";
        return "else"
    }
    var pathStateMachine = {
        beforePath: {
            ws: ["beforePath"],
            ident: ["inIdent", "append"],
            "[": ["beforeElement"],
            eof: ["afterPath"]
        },
        inPath: {
            ws: ["inPath"],
            ".": ["beforeIdent"],
            "[": ["beforeElement"],
            eof: ["afterPath"]
        },
        beforeIdent: {
            ws: ["beforeIdent"],
            ident: ["inIdent", "append"]
        },
        inIdent: {
            ident: ["inIdent", "append"],
            0: ["inIdent", "append"],
            number: ["inIdent", "append"],
            ws: ["inPath", "push"],
            ".": ["beforeIdent", "push"],
            "[": ["beforeElement", "push"],
            eof: ["afterPath", "push"]
        },
        beforeElement: {
            ws: ["beforeElement"],
            0: ["afterZero", "append"],
            number: ["inIndex", "append"],
            "'": ["inSingleQuote", "append", ""],
            '"': ["inDoubleQuote", "append", ""]
        },
        afterZero: {
            ws: ["afterElement", "push"],
            "]": ["inPath", "push"]
        },
        inIndex: {
            0: ["inIndex", "append"],
            number: ["inIndex", "append"],
            ws: ["afterElement"],
            "]": ["inPath", "push"]
        },
        inSingleQuote: {
            "'": ["afterElement"],
            eof: ["error"],
            "else": ["inSingleQuote", "append"]
        },
        inDoubleQuote: {
            '"': ["afterElement"],
            eof: ["error"],
            "else": ["inDoubleQuote", "append"]
        },
        afterElement: {
            ws: ["afterElement"],
            "]": ["inPath", "push"]
        }
    };
    function noop() {}
    function parsePath(path) {
        var keys = [];
        var index = -1;
        var c, newChar, key, type, transition, action, typeMap, mode = "beforePath";
        var actions = {
            push: function() {
                if (key === undefined)
                    return;
                keys.push(key);
                key = undefined
            },
            append: function() {
                if (key === undefined)
                    key = newChar;
                else
                    key += newChar
            }
        };
        function maybeUnescapeQuote() {
            if (index >= path.length)
                return;
            var nextChar = path[index + 1];
            if (mode == "inSingleQuote" && nextChar == "'" || mode == "inDoubleQuote" && nextChar == '"') {
                index++;
                newChar = nextChar;
                actions.append();
                return true
            }
        }
        while (mode) {
            index++;
            c = path[index];
            if (c == "\\" && maybeUnescapeQuote(mode))
                continue;type = getPathCharType(c);
            typeMap = pathStateMachine[mode];
            transition = typeMap[type] || typeMap["else"] || "error";
            if (transition == "error")
                return;
            mode = transition[0];
            action = actions[transition[1]] || noop;
            newChar = transition[2] === undefined ? c : transition[2];
            action();
            if (mode === "afterPath") {
                return keys
            }
        }
        return
    }
    function isIdent(s) {
        return identRegExp.test(s)
    }
    var constructorIsPrivate = {};
    function Path(parts, privateToken) {
        if (privateToken !== constructorIsPrivate)
            throw Error("Use Path.get to retrieve path objects");
        for (var i = 0; i < parts.length; i++) {
            this.push(String(parts[i]))
        }
        if (hasEval && this.length) {
            this.getValueFrom = this.compiledGetValueFromFn()
        }
    }
    var pathCache = {};
    function getPath(pathString) {
        if (pathString instanceof Path)
            return pathString;
        if (pathString == null  || pathString.length == 0)
            pathString = "";
        if (typeof pathString != "string") {
            if (isIndex(pathString.length)) {
                return new Path(pathString,constructorIsPrivate)
            }
            pathString = String(pathString)
        }
        var path = pathCache[pathString];
        if (path)
            return path;
        var parts = parsePath(pathString);
        if (!parts)
            return invalidPath;
        path = new Path(parts,constructorIsPrivate);
        pathCache[pathString] = path;
        return path
    }
    Path.get = getPath;
    function formatAccessor(key) {
        if (isIndex(key)) {
            return "[" + key + "]"
        } else {
            return '["' + key.replace(/"/g, '\\"') + '"]'
        }
    }
    Path.prototype = createObject({
        __proto__: [],
        valid: true,
        toString: function() {
            var pathString = "";
            for (var i = 0; i < this.length; i++) {
                var key = this[i];
                if (isIdent(key)) {
                    pathString += i ? "." + key : key
                } else {
                    pathString += formatAccessor(key)
                }
            }
            return pathString
        },
        getValueFrom: function(obj, directObserver) {
            for (var i = 0; i < this.length; i++) {
                if (obj == null )
                    return;
                obj = obj[this[i]]
            }
            return obj
        },
        iterateObjects: function(obj, observe) {
            for (var i = 0; i < this.length; i++) {
                if (i)
                    obj = obj[this[i - 1]];
                if (!isObject(obj))
                    return;
                observe(obj, this[i])
            }
        },
        compiledGetValueFromFn: function() {
            var str = "";
            var pathString = "obj";
            str += "if (obj != null";
            var i = 0;
            var key;
            for (; i < this.length - 1; i++) {
                key = this[i];
                pathString += isIdent(key) ? "." + key : formatAccessor(key);
                str += " &&\n     " + pathString + " != null"
            }
            str += ")\n";
            key = this[i];
            pathString += isIdent(key) ? "." + key : formatAccessor(key);
            str += "  return " + pathString + ";\nelse\n  return undefined;";
            return new Function("obj",str)
        },
        setValueFrom: function(obj, value) {
            if (!this.length)
                return false;
            for (var i = 0; i < this.length - 1; i++) {
                if (!isObject(obj))
                    return false;
                obj = obj[this[i]]
            }
            if (!isObject(obj))
                return false;
            obj[this[i]] = value;
            return true
        }
    });
    var invalidPath = new Path("",constructorIsPrivate);
    invalidPath.valid = false;
    invalidPath.getValueFrom = invalidPath.setValueFrom = function() {}
    ;
    var MAX_DIRTY_CHECK_CYCLES = 1e3;
    function dirtyCheck(observer) {
        var cycles = 0;
        while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
            cycles++
        }
        if (testingExposeCycleCount)
            global.dirtyCheckCycleCount = cycles;
        return cycles > 0
    }
    function objectIsEmpty(object) {
        for (var prop in object)
            return false;
        return true
    }
    function diffIsEmpty(diff) {
        return objectIsEmpty(diff.added) && objectIsEmpty(diff.removed) && objectIsEmpty(diff.changed)
    }
    function diffObjectFromOldObject(object, oldObject) {
        var added = {};
        var removed = {};
        var changed = {};
        for (var prop in oldObject) {
            var newValue = object[prop];
            if (newValue !== undefined && newValue === oldObject[prop])
                continue;if (!(prop in object)) {
                removed[prop] = undefined;
                continue
            }
            if (newValue !== oldObject[prop])
                changed[prop] = newValue
        }
        for (var prop in object) {
            if (prop in oldObject)
                continue;added[prop] = object[prop]
        }
        if (Array.isArray(object) && object.length !== oldObject.length)
            changed.length = object.length;
        return {
            added: added,
            removed: removed,
            changed: changed
        }
    }
    var eomTasks = [];
    function runEOMTasks() {
        if (!eomTasks.length)
            return false;
        for (var i = 0; i < eomTasks.length; i++) {
            eomTasks[i]()
        }
        eomTasks.length = 0;
        return true
    }
    var runEOM = hasObserve ? function() {
        return function(fn) {
            return Promise.resolve().then(fn)
        }
    }
    () : function() {
        return function(fn) {
            eomTasks.push(fn)
        }
    }
    ();
    var observedObjectCache = [];
    function newObservedObject() {
        var observer;
        var object;
        var discardRecords = false;
        var first = true;
        function callback(records) {
            if (observer && observer.state_ === OPENED && !discardRecords)
                observer.check_(records)
        }
        return {
            open: function(obs) {
                if (observer)
                    throw Error("ObservedObject in use");
                if (!first)
                    Object.deliverChangeRecords(callback);
                observer = obs;
                first = false
            },
            observe: function(obj, arrayObserve) {
                object = obj;
                if (arrayObserve)
                    Array.observe(object, callback);
                else
                    Object.observe(object, callback)
            },
            deliver: function(discard) {
                discardRecords = discard;
                Object.deliverChangeRecords(callback);
                discardRecords = false
            },
            close: function() {
                observer = undefined;
                Object.unobserve(object, callback);
                observedObjectCache.push(this)
            }
        }
    }
    function getObservedObject(observer, object, arrayObserve) {
        var dir = observedObjectCache.pop() || newObservedObject();
        dir.open(observer);
        dir.observe(object, arrayObserve);
        return dir
    }
    var observedSetCache = [];
    function newObservedSet() {
        var observerCount = 0;
        var observers = [];
        var objects = [];
        var rootObj;
        var rootObjProps;
        function observe(obj, prop) {
            if (!obj)
                return;
            if (obj === rootObj)
                rootObjProps[prop] = true;
            if (objects.indexOf(obj) < 0) {
                objects.push(obj);
                Object.observe(obj, callback)
            }
            observe(Object.getPrototypeOf(obj), prop)
        }
        function allRootObjNonObservedProps(recs) {
            for (var i = 0; i < recs.length; i++) {
                var rec = recs[i];
                if (rec.object !== rootObj || rootObjProps[rec.name] || rec.type === "setPrototype") {
                    return false
                }
            }
            return true
        }
        function callback(recs) {
            if (allRootObjNonObservedProps(recs))
                return;
            var observer;
            for (var i = 0; i < observers.length; i++) {
                observer = observers[i];
                if (observer.state_ == OPENED) {
                    observer.iterateObjects_(observe)
                }
            }
            for (var i = 0; i < observers.length; i++) {
                observer = observers[i];
                if (observer.state_ == OPENED) {
                    observer.check_()
                }
            }
        }
        var record = {
            objects: objects,
            get rootObject() {
                return rootObj
            },
            set rootObject(value) {
                rootObj = value;
                rootObjProps = {}
            },
            open: function(obs, object) {
                observers.push(obs);
                observerCount++;
                obs.iterateObjects_(observe)
            },
            close: function(obs) {
                observerCount--;
                if (observerCount > 0) {
                    return
                }
                for (var i = 0; i < objects.length; i++) {
                    Object.unobserve(objects[i], callback);
                    Observer.unobservedCount++
                }
                observers.length = 0;
                objects.length = 0;
                rootObj = undefined;
                rootObjProps = undefined;
                observedSetCache.push(this);
                if (lastObservedSet === this)
                    lastObservedSet = null 
            }
        };
        return record
    }
    var lastObservedSet;
    function getObservedSet(observer, obj) {
        if (!lastObservedSet || lastObservedSet.rootObject !== obj) {
            lastObservedSet = observedSetCache.pop() || newObservedSet();
            lastObservedSet.rootObject = obj
        }
        lastObservedSet.open(observer, obj);
        return lastObservedSet
    }
    var UNOPENED = 0;
    var OPENED = 1;
    var CLOSED = 2;
    var RESETTING = 3;
    var nextObserverId = 1;
    function Observer() {
        this.state_ = UNOPENED;
        this.callback_ = undefined;
        this.target_ = undefined;
        this.directObserver_ = undefined;
        this.value_ = undefined;
        this.id_ = nextObserverId++
    }
    Observer.prototype = {
        open: function(callback, target) {
            if (this.state_ != UNOPENED)
                throw Error("Observer has already been opened.");
            addToAll(this);
            this.callback_ = callback;
            this.target_ = target;
            this.connect_();
            this.state_ = OPENED;
            return this.value_
        },
        close: function() {
            if (this.state_ != OPENED)
                return;
            removeFromAll(this);
            this.disconnect_();
            this.value_ = undefined;
            this.callback_ = undefined;
            this.target_ = undefined;
            this.state_ = CLOSED
        },
        deliver: function() {
            if (this.state_ != OPENED)
                return;
            dirtyCheck(this)
        },
        report_: function(changes) {
            try {
                this.callback_.apply(this.target_, changes)
            } catch (ex) {
                Observer._errorThrownDuringCallback = true;
                console.error("Exception caught during observer callback: " + (ex.stack || ex))
            }
        },
        discardChanges: function() {
            this.check_(undefined, true);
            return this.value_
        }
    };
    var collectObservers = !hasObserve;
    var allObservers;
    Observer._allObserversCount = 0;
    if (collectObservers) {
        allObservers = []
    }
    function addToAll(observer) {
        Observer._allObserversCount++;
        if (!collectObservers)
            return;
        allObservers.push(observer)
    }
    function removeFromAll(observer) {
        Observer._allObserversCount--
    }
    var runningMicrotaskCheckpoint = false;
    global.Platform = global.Platform || {};
    global.Platform.performMicrotaskCheckpoint = function() {
        if (runningMicrotaskCheckpoint)
            return;
        if (!collectObservers)
            return;
        runningMicrotaskCheckpoint = true;
        var cycles = 0;
        var anyChanged, toCheck;
        do {
            cycles++;
            toCheck = allObservers;
            allObservers = [];
            anyChanged = false;
            for (var i = 0; i < toCheck.length; i++) {
                var observer = toCheck[i];
                if (observer.state_ != OPENED)
                    continue;if (observer.check_())
                    anyChanged = true;
                allObservers.push(observer)
            }
            if (runEOMTasks())
                anyChanged = true
        } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);if (testingExposeCycleCount)
            global.dirtyCheckCycleCount = cycles;
        runningMicrotaskCheckpoint = false
    }
    ;
    if (collectObservers) {
        global.Platform.clearObservers = function() {
            allObservers = []
        }
    }
    function ObjectObserver(object) {
        Observer.call(this);
        this.value_ = object;
        this.oldObject_ = undefined
    }
    ObjectObserver.prototype = createObject({
        __proto__: Observer.prototype,
        arrayObserve: false,
        connect_: function(callback, target) {
            if (hasObserve) {
                this.directObserver_ = getObservedObject(this, this.value_, this.arrayObserve)
            } else {
                this.oldObject_ = this.copyObject(this.value_)
            }
        },
        copyObject: function(object) {
            var copy = Array.isArray(object) ? [] : {};
            for (var prop in object) {
                copy[prop] = object[prop]
            }
            if (Array.isArray(object))
                copy.length = object.length;
            return copy
        },
        check_: function(changeRecords, skipChanges) {
            var diff;
            var oldValues;
            if (hasObserve) {
                if (!changeRecords)
                    return false;
                oldValues = {};
                diff = diffObjectFromChangeRecords(this.value_, changeRecords, oldValues)
            } else {
                oldValues = this.oldObject_;
                diff = diffObjectFromOldObject(this.value_, this.oldObject_)
            }
            if (diffIsEmpty(diff))
                return false;
            if (!hasObserve)
                this.oldObject_ = this.copyObject(this.value_);
            this.report_([diff.added || {}, diff.removed || {}, diff.changed || {}, function(property) {
                return oldValues[property]
            }
            ]);
            return true
        },
        disconnect_: function() {
            if (hasObserve) {
                this.directObserver_.close();
                this.directObserver_ = undefined
            } else {
                this.oldObject_ = undefined
            }
        },
        deliver: function() {
            if (this.state_ != OPENED)
                return;
            if (hasObserve)
                this.directObserver_.deliver(false);
            else
                dirtyCheck(this)
        },
        discardChanges: function() {
            if (this.directObserver_)
                this.directObserver_.deliver(true);
            else
                this.oldObject_ = this.copyObject(this.value_);
            return this.value_
        }
    });
    function ArrayObserver(array) {
        if (!Array.isArray(array))
            throw Error("Provided object is not an Array");
        ObjectObserver.call(this, array)
    }
    ArrayObserver.prototype = createObject({
        __proto__: ObjectObserver.prototype,
        arrayObserve: true,
        copyObject: function(arr) {
            return arr.slice()
        },
        check_: function(changeRecords) {
            var splices;
            if (hasObserve) {
                if (!changeRecords)
                    return false;
                splices = projectArraySplices(this.value_, changeRecords)
            } else {
                splices = calcSplices(this.value_, 0, this.value_.length, this.oldObject_, 0, this.oldObject_.length)
            }
            if (!splices || !splices.length)
                return false;
            if (!hasObserve)
                this.oldObject_ = this.copyObject(this.value_);
            this.report_([splices]);
            return true
        }
    });
    ArrayObserver.applySplices = function(previous, current, splices) {
        splices.forEach(function(splice) {
            var spliceArgs = [splice.index, splice.removed.length];
            var addIndex = splice.index;
            while (addIndex < splice.index + splice.addedCount) {
                spliceArgs.push(current[addIndex]);
                addIndex++
            }
            Array.prototype.splice.apply(previous, spliceArgs)
        }
        )
    }
    ;
    function PathObserver(object, path) {
        Observer.call(this);
        this.object_ = object;
        this.path_ = getPath(path);
        this.directObserver_ = undefined
    }
    PathObserver.prototype = createObject({
        __proto__: Observer.prototype,
        get path() {
            return this.path_
        },
        connect_: function() {
            if (hasObserve)
                this.directObserver_ = getObservedSet(this, this.object_);
            this.check_(undefined, true)
        },
        disconnect_: function() {
            this.value_ = undefined;
            if (this.directObserver_) {
                this.directObserver_.close(this);
                this.directObserver_ = undefined
            }
        },
        iterateObjects_: function(observe) {
            this.path_.iterateObjects(this.object_, observe)
        },
        check_: function(changeRecords, skipChanges) {
            var oldValue = this.value_;
            this.value_ = this.path_.getValueFrom(this.object_);
            if (skipChanges || areSameValue(this.value_, oldValue))
                return false;
            this.report_([this.value_, oldValue, this]);
            return true
        },
        setValue: function(newValue) {
            if (this.path_)
                this.path_.setValueFrom(this.object_, newValue)
        }
    });
    function CompoundObserver(reportChangesOnOpen) {
        Observer.call(this);
        this.reportChangesOnOpen_ = reportChangesOnOpen;
        this.value_ = [];
        this.directObserver_ = undefined;
        this.observed_ = []
    }
    var observerSentinel = {};
    CompoundObserver.prototype = createObject({
        __proto__: Observer.prototype,
        connect_: function() {
            if (hasObserve) {
                var object;
                var needsDirectObserver = false;
                for (var i = 0; i < this.observed_.length; i += 2) {
                    object = this.observed_[i];
                    if (object !== observerSentinel) {
                        needsDirectObserver = true;
                        break
                    }
                }
                if (needsDirectObserver)
                    this.directObserver_ = getObservedSet(this, object)
            }
            this.check_(undefined, !this.reportChangesOnOpen_)
        },
        disconnect_: function() {
            for (var i = 0; i < this.observed_.length; i += 2) {
                if (this.observed_[i] === observerSentinel)
                    this.observed_[i + 1].close()
            }
            this.observed_.length = 0;
            this.value_.length = 0;
            if (this.directObserver_) {
                this.directObserver_.close(this);
                this.directObserver_ = undefined
            }
        },
        addPath: function(object, path) {
            if (this.state_ != UNOPENED && this.state_ != RESETTING)
                throw Error("Cannot add paths once started.");
            path = getPath(path);
            this.observed_.push(object, path);
            if (!this.reportChangesOnOpen_)
                return;
            var index = this.observed_.length / 2 - 1;
            this.value_[index] = path.getValueFrom(object)
        },
        addObserver: function(observer) {
            if (this.state_ != UNOPENED && this.state_ != RESETTING)
                throw Error("Cannot add observers once started.");
            this.observed_.push(observerSentinel, observer);
            if (!this.reportChangesOnOpen_)
                return;
            var index = this.observed_.length / 2 - 1;
            this.value_[index] = observer.open(this.deliver, this)
        },
        startReset: function() {
            if (this.state_ != OPENED)
                throw Error("Can only reset while open");
            this.state_ = RESETTING;
            this.disconnect_()
        },
        finishReset: function() {
            if (this.state_ != RESETTING)
                throw Error("Can only finishReset after startReset");
            this.state_ = OPENED;
            this.connect_();
            return this.value_
        },
        iterateObjects_: function(observe) {
            var object;
            for (var i = 0; i < this.observed_.length; i += 2) {
                object = this.observed_[i];
                if (object !== observerSentinel)
                    this.observed_[i + 1].iterateObjects(object, observe)
            }
        },
        check_: function(changeRecords, skipChanges) {
            var oldValues;
            for (var i = 0; i < this.observed_.length; i += 2) {
                var object = this.observed_[i];
                var path = this.observed_[i + 1];
                var value;
                if (object === observerSentinel) {
                    var observable = path;
                    value = this.state_ === UNOPENED ? observable.open(this.deliver, this) : observable.discardChanges()
                } else {
                    value = path.getValueFrom(object)
                }
                if (skipChanges) {
                    this.value_[i / 2] = value;
                    continue
                }
                if (areSameValue(value, this.value_[i / 2]))
                    continue;oldValues = oldValues || [];
                oldValues[i / 2] = this.value_[i / 2];
                this.value_[i / 2] = value
            }
            if (!oldValues)
                return false;
            this.report_([this.value_, oldValues, this.observed_]);
            return true
        }
    });
    function identFn(value) {
        return value
    }
    function ObserverTransform(observable, getValueFn, setValueFn, dontPassThroughSet) {
        this.callback_ = undefined;
        this.target_ = undefined;
        this.value_ = undefined;
        this.observable_ = observable;
        this.getValueFn_ = getValueFn || identFn;
        this.setValueFn_ = setValueFn || identFn;
        this.dontPassThroughSet_ = dontPassThroughSet
    }
    ObserverTransform.prototype = {
        open: function(callback, target) {
            this.callback_ = callback;
            this.target_ = target;
            this.value_ = this.getValueFn_(this.observable_.open(this.observedCallback_, this));
            return this.value_
        },
        observedCallback_: function(value) {
            value = this.getValueFn_(value);
            if (areSameValue(value, this.value_))
                return;
            var oldValue = this.value_;
            this.value_ = value;
            this.callback_.call(this.target_, this.value_, oldValue)
        },
        discardChanges: function() {
            this.value_ = this.getValueFn_(this.observable_.discardChanges());
            return this.value_
        },
        deliver: function() {
            return this.observable_.deliver()
        },
        setValue: function(value) {
            value = this.setValueFn_(value);
            if (!this.dontPassThroughSet_ && this.observable_.setValue)
                return this.observable_.setValue(value)
        },
        close: function() {
            if (this.observable_)
                this.observable_.close();
            this.callback_ = undefined;
            this.target_ = undefined;
            this.observable_ = undefined;
            this.value_ = undefined;
            this.getValueFn_ = undefined;
            this.setValueFn_ = undefined
        }
    };
    var expectedRecordTypes = {
        add: true,
        update: true,
        "delete": true
    };
    function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
        var added = {};
        var removed = {};
        for (var i = 0; i < changeRecords.length; i++) {
            var record = changeRecords[i];
            if (!expectedRecordTypes[record.type]) {
                console.error("Unknown changeRecord type: " + record.type);
                console.error(record);
                continue
            }
            if (!(record.name in oldValues))
                oldValues[record.name] = record.oldValue;
            if (record.type == "update")
                continue;if (record.type == "add") {
                if (record.name in removed)
                    delete removed[record.name];
                else
                    added[record.name] = true;
                continue
            }
            if (record.name in added) {
                delete added[record.name];
                delete oldValues[record.name]
            } else {
                removed[record.name] = true
            }
        }
        for (var prop in added)
            added[prop] = object[prop];
        for (var prop in removed)
            removed[prop] = undefined;
        var changed = {};
        for (var prop in oldValues) {
            if (prop in added || prop in removed)
                continue;var newValue = object[prop];
            if (oldValues[prop] !== newValue)
                changed[prop] = newValue
        }
        return {
            added: added,
            removed: removed,
            changed: changed
        }
    }
    function newSplice(index, removed, addedCount) {
        return {
            index: index,
            removed: removed,
            addedCount: addedCount
        }
    }
    var EDIT_LEAVE = 0;
    var EDIT_UPDATE = 1;
    var EDIT_ADD = 2;
    var EDIT_DELETE = 3;
    function ArraySplice() {}
    ArraySplice.prototype = {
        calcEditDistances: function(current, currentStart, currentEnd, old, oldStart, oldEnd) {
            var rowCount = oldEnd - oldStart + 1;
            var columnCount = currentEnd - currentStart + 1;
            var distances = new Array(rowCount);
            for (var i = 0; i < rowCount; i++) {
                distances[i] = new Array(columnCount);
                distances[i][0] = i
            }
            for (var j = 0; j < columnCount; j++)
                distances[0][j] = j;
            for (var i = 1; i < rowCount; i++) {
                for (var j = 1; j < columnCount; j++) {
                    if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
                        distances[i][j] = distances[i - 1][j - 1];
                    else {
                        var north = distances[i - 1][j] + 1;
                        var west = distances[i][j - 1] + 1;
                        distances[i][j] = north < west ? north : west
                    }
                }
            }
            return distances
        },
        spliceOperationsFromEditDistances: function(distances) {
            var i = distances.length - 1;
            var j = distances[0].length - 1;
            var current = distances[i][j];
            var edits = [];
            while (i > 0 || j > 0) {
                if (i == 0) {
                    edits.push(EDIT_ADD);
                    j--;
                    continue
                }
                if (j == 0) {
                    edits.push(EDIT_DELETE);
                    i--;
                    continue
                }
                var northWest = distances[i - 1][j - 1];
                var west = distances[i - 1][j];
                var north = distances[i][j - 1];
                var min;
                if (west < north)
                    min = west < northWest ? west : northWest;
                else
                    min = north < northWest ? north : northWest;
                if (min == northWest) {
                    if (northWest == current) {
                        edits.push(EDIT_LEAVE)
                    } else {
                        edits.push(EDIT_UPDATE);
                        current = northWest
                    }
                    i--;
                    j--
                } else if (min == west) {
                    edits.push(EDIT_DELETE);
                    i--;
                    current = west
                } else {
                    edits.push(EDIT_ADD);
                    j--;
                    current = north
                }
            }
            edits.reverse();
            return edits
        },
        calcSplices: function(current, currentStart, currentEnd, old, oldStart, oldEnd) {
            var prefixCount = 0;
            var suffixCount = 0;
            var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
            if (currentStart == 0 && oldStart == 0)
                prefixCount = this.sharedPrefix(current, old, minLength);
            if (currentEnd == current.length && oldEnd == old.length)
                suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);
            currentStart += prefixCount;
            oldStart += prefixCount;
            currentEnd -= suffixCount;
            oldEnd -= suffixCount;
            if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
                return [];
            if (currentStart == currentEnd) {
                var splice = newSplice(currentStart, [], 0);
                while (oldStart < oldEnd)
                    splice.removed.push(old[oldStart++]);
                return [splice]
            } else if (oldStart == oldEnd)
                return [newSplice(currentStart, [], currentEnd - currentStart)];
            var ops = this.spliceOperationsFromEditDistances(this.calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));
            var splice = undefined;
            var splices = [];
            var index = currentStart;
            var oldIndex = oldStart;
            for (var i = 0; i < ops.length; i++) {
                switch (ops[i]) {
                case EDIT_LEAVE:
                    if (splice) {
                        splices.push(splice);
                        splice = undefined
                    }
                    index++;
                    oldIndex++;
                    break;
                case EDIT_UPDATE:
                    if (!splice)
                        splice = newSplice(index, [], 0);
                    splice.addedCount++;
                    index++;
                    splice.removed.push(old[oldIndex]);
                    oldIndex++;
                    break;
                case EDIT_ADD:
                    if (!splice)
                        splice = newSplice(index, [], 0);
                    splice.addedCount++;
                    index++;
                    break;
                case EDIT_DELETE:
                    if (!splice)
                        splice = newSplice(index, [], 0);
                    splice.removed.push(old[oldIndex]);
                    oldIndex++;
                    break
                }
            }
            if (splice) {
                splices.push(splice)
            }
            return splices
        },
        sharedPrefix: function(current, old, searchLength) {
            for (var i = 0; i < searchLength; i++)
                if (!this.equals(current[i], old[i]))
                    return i;
            return searchLength
        },
        sharedSuffix: function(current, old, searchLength) {
            var index1 = current.length;
            var index2 = old.length;
            var count = 0;
            while (count < searchLength && this.equals(current[--index1], old[--index2]))
                count++;
            return count
        },
        calculateSplices: function(current, previous) {
            return this.calcSplices(current, 0, current.length, previous, 0, previous.length)
        },
        equals: function(currentValue, previousValue) {
            return currentValue === previousValue
        }
    };
    var arraySplice = new ArraySplice;
    function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
        return arraySplice.calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd)
    }
    function intersect(start1, end1, start2, end2) {
        if (end1 < start2 || end2 < start1)
            return -1;
        if (end1 == start2 || end2 == start1)
            return 0;
        if (start1 < start2) {
            if (end1 < end2)
                return end1 - start2;
            else
                return end2 - start2
        } else {
            if (end2 < end1)
                return end2 - start1;
            else
                return end1 - start1
        }
    }
    function mergeSplice(splices, index, removed, addedCount) {
        var splice = newSplice(index, removed, addedCount);
        var inserted = false;
        var insertionOffset = 0;
        for (var i = 0; i < splices.length; i++) {
            var current = splices[i];
            current.index += insertionOffset;
            if (inserted)
                continue;var intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);
            if (intersectCount >= 0) {
                splices.splice(i, 1);
                i--;
                insertionOffset -= current.addedCount - current.removed.length;
                splice.addedCount += current.addedCount - intersectCount;
                var deleteCount = splice.removed.length + current.removed.length - intersectCount;
                if (!splice.addedCount && !deleteCount) {
                    inserted = true
                } else {
                    removed = current.removed;
                    if (splice.index < current.index) {
                        var prepend = splice.removed.slice(0, current.index - splice.index);
                        Array.prototype.push.apply(prepend, removed);
                        removed = prepend
                    }
                    if (splice.index + splice.removed.length > current.index + current.addedCount) {
                        var append = splice.removed.slice(current.index + current.addedCount - splice.index);
                        Array.prototype.push.apply(removed, append)
                    }
                    splice.removed = removed;
                    if (current.index < splice.index) {
                        splice.index = current.index
                    }
                }
            } else if (splice.index < current.index) {
                inserted = true;
                splices.splice(i, 0, splice);
                i++;
                var offset = splice.addedCount - splice.removed.length;
                current.index += offset;
                insertionOffset += offset
            }
        }
        if (!inserted)
            splices.push(splice)
    }
    function createInitialSplices(array, changeRecords) {
        var splices = [];
        for (var i = 0; i < changeRecords.length; i++) {
            var record = changeRecords[i];
            switch (record.type) {
            case "splice":
                mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
                break;
            case "add":
            case "update":
            case "delete":
                if (!isIndex(record.name))
                    continue;var index = toNumber(record.name);
                if (index < 0)
                    continue;mergeSplice(splices, index, [record.oldValue], 1);
                break;
            default:
                console.error("Unexpected record type: " + JSON.stringify(record));
                break
            }
        }
        return splices
    }
    function projectArraySplices(array, changeRecords) {
        var splices = [];
        createInitialSplices(array, changeRecords).forEach(function(splice) {
            if (splice.addedCount == 1 && splice.removed.length == 1) {
                if (splice.removed[0] !== array[splice.index])
                    splices.push(splice);
                return
            }
            splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length))
        }
        );
        return splices
    }
    var expose = global;
    if (typeof exports !== "undefined" && !exports.nodeType) {
        if (typeof module !== "undefined" && module.exports) {
            exports = module.exports
        }
        expose = exports
    }
    expose.Observer = Observer;
    expose.Observer.runEOM_ = runEOM;
    expose.Observer.observerSentinel_ = observerSentinel;
    expose.Observer.hasObjectObserve = hasObserve;
    expose.ArrayObserver = ArrayObserver;
    expose.ArrayObserver.calculateSplices = function(current, previous) {
        return arraySplice.calculateSplices(current, previous)
    }
    ;
    expose.ArraySplice = ArraySplice;
    expose.ObjectObserver = ObjectObserver;
    expose.PathObserver = PathObserver;
    expose.CompoundObserver = CompoundObserver;
    expose.Path = Path;
    expose.ObserverTransform = ObserverTransform
}
)(typeof global !== "undefined" && global && typeof module !== "undefined" && module ? global : this || window);
(function(global) {
    "use strict";
    var filter = Array.prototype.filter.call.bind(Array.prototype.filter);
    function getTreeScope(node) {
        while (node.parentNode) {
            node = node.parentNode
        }
        return typeof node.getElementById === "function" ? node : null 
    }
    Node.prototype.bind = function(name, observable) {
        console.error("Unhandled binding to Node: ", this, name, observable)
    }
    ;
    Node.prototype.bindFinished = function() {}
    ;
    function updateBindings(node, name, binding) {
        var bindings = node.bindings_;
        if (!bindings)
            bindings = node.bindings_ = {};
        if (bindings[name])
            binding[name].close();
        return bindings[name] = binding
    }
    function returnBinding(node, name, binding) {
        return binding
    }
    function sanitizeValue(value) {
        return value == null  ? "" : value
    }
    function updateText(node, value) {
        node.data = sanitizeValue(value)
    }
    function textBinding(node) {
        return function(value) {
            return updateText(node, value)
        }
    }
    var maybeUpdateBindings = returnBinding;
    Object.defineProperty(Platform, "enableBindingsReflection", {
        get: function() {
            return maybeUpdateBindings === updateBindings
        },
        set: function(enable) {
            maybeUpdateBindings = enable ? updateBindings : returnBinding;
            return enable
        },
        configurable: true
    });
    Text.prototype.bind = function(name, value, oneTime) {
        if (name !== "textContent")
            return Node.prototype.bind.call(this, name, value, oneTime);
        if (oneTime)
            return updateText(this, value);
        var observable = value;
        updateText(this, observable.open(textBinding(this)));
        return maybeUpdateBindings(this, name, observable)
    }
    ;
    function updateAttribute(el, name, conditional, value) {
        if (conditional) {
            if (value)
                el.setAttribute(name, "");
            else
                el.removeAttribute(name);
            return
        }
        el.setAttribute(name, sanitizeValue(value))
    }
    function attributeBinding(el, name, conditional) {
        return function(value) {
            updateAttribute(el, name, conditional, value)
        }
    }
    Element.prototype.bind = function(name, value, oneTime) {
        var conditional = name[name.length - 1] == "?";
        if (conditional) {
            this.removeAttribute(name);
            name = name.slice(0, -1)
        }
        if (oneTime)
            return updateAttribute(this, name, conditional, value);
        var observable = value;
        updateAttribute(this, name, conditional, observable.open(attributeBinding(this, name, conditional)));
        return maybeUpdateBindings(this, name, observable)
    }
    ;
    var checkboxEventType;
    (function() {
        var div = document.createElement("div");
        var checkbox = div.appendChild(document.createElement("input"));
        checkbox.setAttribute("type", "checkbox");
        var first;
        var count = 0;
        checkbox.addEventListener("click", function(e) {
            count++;
            first = first || "click"
        }
        );
        checkbox.addEventListener("change", function() {
            count++;
            first = first || "change"
        }
        );
        var event = document.createEvent("MouseEvent");
        event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null );
        checkbox.dispatchEvent(event);
        checkboxEventType = count == 1 ? "change" : first
    }
    )();
    function getEventForInputType(element) {
        switch (element.type) {
        case "checkbox":
            return checkboxEventType;
        case "radio":
        case "select-multiple":
        case "select-one":
            return "change";
        case "range":
            if (/Trident|MSIE/.test(navigator.userAgent))
                return "change";
        default:
            return "input"
        }
    }
    function updateInput(input, property, value, santizeFn) {
        input[property] = (santizeFn || sanitizeValue)(value)
    }
    function inputBinding(input, property, santizeFn) {
        return function(value) {
            return updateInput(input, property, value, santizeFn)
        }
    }
    function noop() {}
    function bindInputEvent(input, property, observable, postEventFn) {
        var eventType = getEventForInputType(input);
        function eventHandler() {
            var isNum = property == "value" && input.type == "number";
            observable.setValue(isNum ? input.valueAsNumber : input[property]);
            observable.discardChanges();
            (postEventFn || noop)(input);
            Platform.performMicrotaskCheckpoint()
        }
        input.addEventListener(eventType, eventHandler);
        return {
            close: function() {
                input.removeEventListener(eventType, eventHandler);
                observable.close()
            },
            observable_: observable
        }
    }
    function booleanSanitize(value) {
        return Boolean(value)
    }
    function getAssociatedRadioButtons(element) {
        if (element.form) {
            return filter(element.form.elements, function(el) {
                return el != element && el.tagName == "INPUT" && el.type == "radio" && el.name == element.name
            }
            )
        } else {
            var treeScope = getTreeScope(element);
            if (!treeScope)
                return [];
            var radios = treeScope.querySelectorAll('input[type="radio"][name="' + element.name + '"]');
            return filter(radios, function(el) {
                return el != element && !el.form
            }
            )
        }
    }
    function checkedPostEvent(input) {
        if (input.tagName === "INPUT" && input.type === "radio") {
            getAssociatedRadioButtons(input).forEach(function(radio) {
                var checkedBinding = radio.bindings_.checked;
                if (checkedBinding) {
                    checkedBinding.observable_.setValue(false)
                }
            }
            )
        }
    }
    HTMLInputElement.prototype.bind = function(name, value, oneTime) {
        if (name !== "value" && name !== "checked")
            return HTMLElement.prototype.bind.call(this, name, value, oneTime);
        this.removeAttribute(name);
        var sanitizeFn = name == "checked" ? booleanSanitize : sanitizeValue;
        var postEventFn = name == "checked" ? checkedPostEvent : noop;
        if (oneTime)
            return updateInput(this, name, value, sanitizeFn);
        var observable = value;
        var binding = bindInputEvent(this, name, observable, postEventFn);
        updateInput(this, name, observable.open(inputBinding(this, name, sanitizeFn)), sanitizeFn);
        return updateBindings(this, name, binding)
    }
    ;
    HTMLTextAreaElement.prototype.bind = function(name, value, oneTime) {
        if (name !== "value")
            return HTMLElement.prototype.bind.call(this, name, value, oneTime);
        this.removeAttribute("value");
        if (oneTime)
            return updateInput(this, "value", value);
        var observable = value;
        var binding = bindInputEvent(this, "value", observable);
        updateInput(this, "value", observable.open(inputBinding(this, "value", sanitizeValue)));
        return maybeUpdateBindings(this, name, binding)
    }
    ;
    function updateOption(option, value) {
        var parentNode = option.parentNode;
        var select;
        var selectBinding;
        var oldValue;
        if (parentNode instanceof HTMLSelectElement && parentNode.bindings_ && parentNode.bindings_.value) {
            select = parentNode;
            selectBinding = select.bindings_.value;
            oldValue = select.value
        }
        option.value = sanitizeValue(value);
        if (select && select.value != oldValue) {
            selectBinding.observable_.setValue(select.value);
            selectBinding.observable_.discardChanges();
            Platform.performMicrotaskCheckpoint()
        }
    }
    function optionBinding(option) {
        return function(value) {
            updateOption(option, value)
        }
    }
    HTMLOptionElement.prototype.bind = function(name, value, oneTime) {
        if (name !== "value")
            return HTMLElement.prototype.bind.call(this, name, value, oneTime);
        this.removeAttribute("value");
        if (oneTime)
            return updateOption(this, value);
        var observable = value;
        var binding = bindInputEvent(this, "value", observable);
        updateOption(this, observable.open(optionBinding(this)));
        return maybeUpdateBindings(this, name, binding)
    }
    ;
    HTMLSelectElement.prototype.bind = function(name, value, oneTime) {
        if (name === "selectedindex")
            name = "selectedIndex";
        if (name !== "selectedIndex" && name !== "value")
            return HTMLElement.prototype.bind.call(this, name, value, oneTime);
        this.removeAttribute(name);
        if (oneTime)
            return updateInput(this, name, value);
        var observable = value;
        var binding = bindInputEvent(this, name, observable);
        updateInput(this, name, observable.open(inputBinding(this, name)));
        return updateBindings(this, name, binding)
    }
}
)(this);
(function(global) {
    "use strict";
    function assert(v) {
        if (!v)
            throw new Error("Assertion failed")
    }
    var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
    function getFragmentRoot(node) {
        var p;
        while (p = node.parentNode) {
            node = p
        }
        return node
    }
    function searchRefId(node, id) {
        if (!id)
            return;
        var ref;
        var selector = "#" + id;
        while (!ref) {
            node = getFragmentRoot(node);
            if (node.protoContent_)
                ref = node.protoContent_.querySelector(selector);
            else if (node.getElementById)
                ref = node.getElementById(id);
            if (ref || !node.templateCreator_)
                break;
            node = node.templateCreator_
        }
        return ref
    }
    function getInstanceRoot(node) {
        while (node.parentNode) {
            node = node.parentNode
        }
        return node.templateCreator_ ? node : null 
    }
    var Map;
    if (global.Map && typeof global.Map.prototype.forEach === "function") {
        Map = global.Map
    } else {
        Map = function() {
            this.keys = [];
            this.values = []
        }
        ;
        Map.prototype = {
            set: function(key, value) {
                var index = this.keys.indexOf(key);
                if (index < 0) {
                    this.keys.push(key);
                    this.values.push(value)
                } else {
                    this.values[index] = value
                }
            },
            get: function(key) {
                var index = this.keys.indexOf(key);
                if (index < 0)
                    return;
                return this.values[index]
            },
            "delete": function(key, value) {
                var index = this.keys.indexOf(key);
                if (index < 0)
                    return false;
                this.keys.splice(index, 1);
                this.values.splice(index, 1);
                return true
            },
            forEach: function(f, opt_this) {
                for (var i = 0; i < this.keys.length; i++)
                    f.call(opt_this || this, this.values[i], this.keys[i], this)
            }
        }
    }
    var createObject = "__proto__" in {} ? function(obj) {
        return obj
    }
     : function(obj) {
        var proto = obj.__proto__;
        if (!proto)
            return obj;
        var newObject = Object.create(proto);
        Object.getOwnPropertyNames(obj).forEach(function(name) {
            Object.defineProperty(newObject, name, Object.getOwnPropertyDescriptor(obj, name))
        }
        );
        return newObject
    }
    ;
    if (typeof document.contains != "function") {
        Document.prototype.contains = function(node) {
            if (node === this || node.parentNode === this)
                return true;
            return this.documentElement.contains(node)
        }
    }
    var BIND = "bind";
    var REPEAT = "repeat";
    var IF = "if";
    var templateAttributeDirectives = {
        template: true,
        repeat: true,
        bind: true,
        ref: true,
        "if": true
    };
    var semanticTemplateElements = {
        THEAD: true,
        TBODY: true,
        TFOOT: true,
        TH: true,
        TR: true,
        TD: true,
        COLGROUP: true,
        COL: true,
        CAPTION: true,
        OPTION: true,
        OPTGROUP: true
    };
    var hasTemplateElement = typeof HTMLTemplateElement !== "undefined";
    if (hasTemplateElement) {
        (function() {
            var t = document.createElement("template");
            var d = t.content.ownerDocument;
            var html = d.appendChild(d.createElement("html"));
            var head = html.appendChild(d.createElement("head"));
            var base = d.createElement("base");
            base.href = document.baseURI;
            head.appendChild(base)
        }
        )()
    }
    var allTemplatesSelectors = "template, " + Object.keys(semanticTemplateElements).map(function(tagName) {
        return tagName.toLowerCase() + "[template]"
    }
    ).join(", ");
    function isSVGTemplate(el) {
        return el.tagName == "template" && el.namespaceURI == "http://www.w3.org/2000/svg"
    }
    function isHTMLTemplate(el) {
        return el.tagName == "TEMPLATE" && el.namespaceURI == "http://www.w3.org/1999/xhtml"
    }
    function isAttributeTemplate(el) {
        return Boolean(semanticTemplateElements[el.tagName] && el.hasAttribute("template"))
    }
    function isTemplate(el) {
        if (el.isTemplate_ === undefined)
            el.isTemplate_ = el.tagName == "TEMPLATE" || isAttributeTemplate(el);
        return el.isTemplate_
    }
    document.addEventListener("DOMContentLoaded", function(e) {
        bootstrapTemplatesRecursivelyFrom(document);
        Platform.performMicrotaskCheckpoint()
    }
    , false);
    function forAllTemplatesFrom(node, fn) {
        var subTemplates = node.querySelectorAll(allTemplatesSelectors);
        if (isTemplate(node))
            fn(node);
        forEach(subTemplates, fn)
    }
    function bootstrapTemplatesRecursivelyFrom(node) {
        function bootstrap(template) {
            if (!HTMLTemplateElement.decorate(template))
                bootstrapTemplatesRecursivelyFrom(template.content)
        }
        forAllTemplatesFrom(node, bootstrap)
    }
    if (!hasTemplateElement) {
        global.HTMLTemplateElement = function() {
            throw TypeError("Illegal constructor")
        }
    }
    var hasProto = "__proto__" in {};
    function mixin(to, from) {
        Object.getOwnPropertyNames(from).forEach(function(name) {
            Object.defineProperty(to, name, Object.getOwnPropertyDescriptor(from, name))
        }
        )
    }
    function getOrCreateTemplateContentsOwner(template) {
        var doc = template.ownerDocument;
        if (!doc.defaultView)
            return doc;
        var d = doc.templateContentsOwner_;
        if (!d) {
            d = doc.implementation.createHTMLDocument("");
            while (d.lastChild) {
                d.removeChild(d.lastChild)
            }
            doc.templateContentsOwner_ = d
        }
        return d
    }
    function getTemplateStagingDocument(template) {
        if (!template.stagingDocument_) {
            var owner = template.ownerDocument;
            if (!owner.stagingDocument_) {
                owner.stagingDocument_ = owner.implementation.createHTMLDocument("");
                owner.stagingDocument_.isStagingDocument = true;
                var base = owner.stagingDocument_.createElement("base");
                base.href = document.baseURI;
                owner.stagingDocument_.head.appendChild(base);
                owner.stagingDocument_.stagingDocument_ = owner.stagingDocument_
            }
            template.stagingDocument_ = owner.stagingDocument_
        }
        return template.stagingDocument_
    }
    function extractTemplateFromAttributeTemplate(el) {
        var template = el.ownerDocument.createElement("template");
        el.parentNode.insertBefore(template, el);
        var attribs = el.attributes;
        var count = attribs.length;
        while (count-- > 0) {
            var attrib = attribs[count];
            if (templateAttributeDirectives[attrib.name]) {
                if (attrib.name !== "template")
                    template.setAttribute(attrib.name, attrib.value);
                el.removeAttribute(attrib.name)
            }
        }
        return template
    }
    function extractTemplateFromSVGTemplate(el) {
        var template = el.ownerDocument.createElement("template");
        el.parentNode.insertBefore(template, el);
        var attribs = el.attributes;
        var count = attribs.length;
        while (count-- > 0) {
            var attrib = attribs[count];
            template.setAttribute(attrib.name, attrib.value);
            el.removeAttribute(attrib.name)
        }
        el.parentNode.removeChild(el);
        return template
    }
    function liftNonNativeTemplateChildrenIntoContent(template, el, useRoot) {
        var content = template.content;
        if (useRoot) {
            content.appendChild(el);
            return
        }
        var child;
        while (child = el.firstChild) {
            content.appendChild(child)
        }
    }
    var templateObserver;
    if (typeof MutationObserver == "function") {
        templateObserver = new MutationObserver(function(records) {
            for (var i = 0; i < records.length; i++) {
                records[i].target.refChanged_()
            }
        }
        )
    }
    HTMLTemplateElement.decorate = function(el, opt_instanceRef) {
        if (el.templateIsDecorated_)
            return false;
        var templateElement = el;
        templateElement.templateIsDecorated_ = true;
        var isNativeHTMLTemplate = isHTMLTemplate(templateElement) && hasTemplateElement;
        var bootstrapContents = isNativeHTMLTemplate;
        var liftContents = !isNativeHTMLTemplate;
        var liftRoot = false;
        if (!isNativeHTMLTemplate) {
            if (isAttributeTemplate(templateElement)) {
                assert(!opt_instanceRef);
                templateElement = extractTemplateFromAttributeTemplate(el);
                templateElement.templateIsDecorated_ = true;
                isNativeHTMLTemplate = hasTemplateElement;
                liftRoot = true
            } else if (isSVGTemplate(templateElement)) {
                templateElement = extractTemplateFromSVGTemplate(el);
                templateElement.templateIsDecorated_ = true;
                isNativeHTMLTemplate = hasTemplateElement
            }
        }
        if (!isNativeHTMLTemplate) {
            fixTemplateElementPrototype(templateElement);
            var doc = getOrCreateTemplateContentsOwner(templateElement);
            templateElement.content_ = doc.createDocumentFragment()
        }
        if (opt_instanceRef) {
            templateElement.instanceRef_ = opt_instanceRef
        } else if (liftContents) {
            liftNonNativeTemplateChildrenIntoContent(templateElement, el, liftRoot)
        } else if (bootstrapContents) {
            bootstrapTemplatesRecursivelyFrom(templateElement.content)
        }
        return true
    }
    ;
    HTMLTemplateElement.bootstrap = bootstrapTemplatesRecursivelyFrom;
    var htmlElement = global.HTMLUnknownElement || HTMLElement;
    var contentDescriptor = {
        get: function() {
            return this.content_
        },
        enumerable: true,
        configurable: true
    };
    if (!hasTemplateElement) {
        HTMLTemplateElement.prototype = Object.create(htmlElement.prototype);
        Object.defineProperty(HTMLTemplateElement.prototype, "content", contentDescriptor)
    }
    function fixTemplateElementPrototype(el) {
        if (hasProto)
            el.__proto__ = HTMLTemplateElement.prototype;
        else
            mixin(el, HTMLTemplateElement.prototype)
    }
    function ensureSetModelScheduled(template) {
        if (!template.setModelFn_) {
            template.setModelFn_ = function() {
                template.setModelFnScheduled_ = false;
                var map = getBindings(template, template.delegate_ && template.delegate_.prepareBinding);
                processBindings(template, map, template.model_)
            }
        }
        if (!template.setModelFnScheduled_) {
            template.setModelFnScheduled_ = true;
            Observer.runEOM_(template.setModelFn_)
        }
    }
    mixin(HTMLTemplateElement.prototype, {
        bind: function(name, value, oneTime) {
            if (name != "ref")
                return Element.prototype.bind.call(this, name, value, oneTime);
            var self = this;
            var ref = oneTime ? value : value.open(function(ref) {
                self.setAttribute("ref", ref);
                self.refChanged_()
            }
            );
            this.setAttribute("ref", ref);
            this.refChanged_();
            if (oneTime)
                return;
            if (!this.bindings_) {
                this.bindings_ = {
                    ref: value
                }
            } else {
                this.bindings_.ref = value
            }
            return value
        },
        processBindingDirectives_: function(directives) {
            if (this.iterator_)
                this.iterator_.closeDeps();
            if (!directives.if && !directives.bind && !directives.repeat) {
                if (this.iterator_) {
                    this.iterator_.close();
                    this.iterator_ = undefined
                }
                return
            }
            if (!this.iterator_) {
                this.iterator_ = new TemplateIterator(this)
            }
            this.iterator_.updateDependencies(directives, this.model_);
            if (templateObserver) {
                templateObserver.observe(this, {
                    attributes: true,
                    attributeFilter: ["ref"]
                })
            }
            return this.iterator_
        },
        createInstance: function(model, bindingDelegate, delegate_) {
            if (bindingDelegate)
                delegate_ = this.newDelegate_(bindingDelegate);
            else if (!delegate_)
                delegate_ = this.delegate_;
            if (!this.refContent_)
                this.refContent_ = this.ref_.content;
            var content = this.refContent_;
            if (content.firstChild === null )
                return emptyInstance;
            var map = getInstanceBindingMap(content, delegate_);
            var stagingDocument = getTemplateStagingDocument(this);
            var instance = stagingDocument.createDocumentFragment();
            instance.templateCreator_ = this;
            instance.protoContent_ = content;
            instance.bindings_ = [];
            instance.terminator_ = null ;
            var instanceRecord = instance.templateInstance_ = {
                firstNode: null ,
                lastNode: null ,
                model: model
            };
            var i = 0;
            var collectTerminator = false;
            for (var child = content.firstChild; child; child = child.nextSibling) {
                if (child.nextSibling === null )
                    collectTerminator = true;
                var clone = cloneAndBindInstance(child, instance, stagingDocument, map.children[i++], model, delegate_, instance.bindings_);
                clone.templateInstance_ = instanceRecord;
                if (collectTerminator)
                    instance.terminator_ = clone
            }
            instanceRecord.firstNode = instance.firstChild;
            instanceRecord.lastNode = instance.lastChild;
            instance.templateCreator_ = undefined;
            instance.protoContent_ = undefined;
            return instance
        },
        get model() {
            return this.model_
        },
        set model(model) {
            this.model_ = model;
            ensureSetModelScheduled(this)
        },
        get bindingDelegate() {
            return this.delegate_ && this.delegate_.raw
        },
        refChanged_: function() {
            if (!this.iterator_ || this.refContent_ === this.ref_.content)
                return;
            this.refContent_ = undefined;
            this.iterator_.valueChanged();
            this.iterator_.updateIteratedValue(this.iterator_.getUpdatedValue())
        },
        clear: function() {
            this.model_ = undefined;
            this.delegate_ = undefined;
            if (this.bindings_ && this.bindings_.ref)
                this.bindings_.ref.close();
            this.refContent_ = undefined;
            if (!this.iterator_)
                return;
            this.iterator_.valueChanged();
            this.iterator_.close();
            this.iterator_ = undefined
        },
        setDelegate_: function(delegate) {
            this.delegate_ = delegate;
            this.bindingMap_ = undefined;
            if (this.iterator_) {
                this.iterator_.instancePositionChangedFn_ = undefined;
                this.iterator_.instanceModelFn_ = undefined
            }
        },
        newDelegate_: function(bindingDelegate) {
            if (!bindingDelegate)
                return;
            function delegateFn(name) {
                var fn = bindingDelegate && bindingDelegate[name];
                if (typeof fn != "function")
                    return;
                return function() {
                    return fn.apply(bindingDelegate, arguments)
                }
            }
            return {
                bindingMaps: {},
                raw: bindingDelegate,
                prepareBinding: delegateFn("prepareBinding"),
                prepareInstanceModel: delegateFn("prepareInstanceModel"),
                prepareInstancePositionChanged: delegateFn("prepareInstancePositionChanged")
            }
        },
        set bindingDelegate(bindingDelegate) {
            if (this.delegate_) {
                throw Error("Template must be cleared before a new bindingDelegate " + "can be assigned")
            }
            this.setDelegate_(this.newDelegate_(bindingDelegate))
        },
        get ref_() {
            var ref = searchRefId(this, this.getAttribute("ref"));
            if (!ref)
                ref = this.instanceRef_;
            if (!ref)
                return this;
            var nextRef = ref.ref_;
            return nextRef ? nextRef : ref
        }
    });
    function parseMustaches(s, name, node, prepareBindingFn) {
        if (!s || !s.length)
            return;
        var tokens;
        var length = s.length;
        var startIndex = 0
          , lastIndex = 0
          , endIndex = 0;
        var onlyOneTime = true;
        while (lastIndex < length) {
            startIndex = s.indexOf("{{", lastIndex);
            var oneTimeStart = s.indexOf("[[", lastIndex);
            var oneTime = false;
            var terminator = "}}";
            if (oneTimeStart >= 0 && (startIndex < 0 || oneTimeStart < startIndex)) {
                startIndex = oneTimeStart;
                oneTime = true;
                terminator = "]]"
            }
            endIndex = startIndex < 0 ? -1 : s.indexOf(terminator, startIndex + 2);
            if (endIndex < 0) {
                if (!tokens)
                    return;
                tokens.push(s.slice(lastIndex));
                break
            }
            tokens = tokens || [];
            tokens.push(s.slice(lastIndex, startIndex));
            var pathString = s.slice(startIndex + 2, endIndex).trim();
            tokens.push(oneTime);
            onlyOneTime = onlyOneTime && oneTime;
            var delegateFn = prepareBindingFn && prepareBindingFn(pathString, name, node);
            if (delegateFn == null ) {
                tokens.push(Path.get(pathString))
            } else {
                tokens.push(null )
            }
            tokens.push(delegateFn);
            lastIndex = endIndex + 2
        }
        if (lastIndex === length)
            tokens.push("");
        tokens.hasOnePath = tokens.length === 5;
        tokens.isSimplePath = tokens.hasOnePath && tokens[0] == "" && tokens[4] == "";
        tokens.onlyOneTime = onlyOneTime;
        tokens.combinator = function(values) {
            var newValue = tokens[0];
            for (var i = 1; i < tokens.length; i += 4) {
                var value = tokens.hasOnePath ? values : values[(i - 1) / 4];
                if (value !== undefined)
                    newValue += value;
                newValue += tokens[i + 3]
            }
            return newValue
        }
        ;
        return tokens
    }
    function processOneTimeBinding(name, tokens, node, model) {
        if (tokens.hasOnePath) {
            var delegateFn = tokens[3];
            var value = delegateFn ? delegateFn(model, node, true) : tokens[2].getValueFrom(model);
            return tokens.isSimplePath ? value : tokens.combinator(value)
        }
        var values = [];
        for (var i = 1; i < tokens.length; i += 4) {
            var delegateFn = tokens[i + 2];
            values[(i - 1) / 4] = delegateFn ? delegateFn(model, node) : tokens[i + 1].getValueFrom(model)
        }
        return tokens.combinator(values)
    }
    function processSinglePathBinding(name, tokens, node, model) {
        var delegateFn = tokens[3];
        var observer = delegateFn ? delegateFn(model, node, false) : new PathObserver(model,tokens[2]);
        return tokens.isSimplePath ? observer : new ObserverTransform(observer,tokens.combinator)
    }
    function processBinding(name, tokens, node, model) {
        if (tokens.onlyOneTime)
            return processOneTimeBinding(name, tokens, node, model);
        if (tokens.hasOnePath)
            return processSinglePathBinding(name, tokens, node, model);
        var observer = new CompoundObserver;
        for (var i = 1; i < tokens.length; i += 4) {
            var oneTime = tokens[i];
            var delegateFn = tokens[i + 2];
            if (delegateFn) {
                var value = delegateFn(model, node, oneTime);
                if (oneTime)
                    observer.addPath(value);
                else
                    observer.addObserver(value);
                continue
            }
            var path = tokens[i + 1];
            if (oneTime)
                observer.addPath(path.getValueFrom(model));
            else
                observer.addPath(model, path)
        }
        return new ObserverTransform(observer,tokens.combinator)
    }
    function processBindings(node, bindings, model, instanceBindings) {
        for (var i = 0; i < bindings.length; i += 2) {
            var name = bindings[i];
            var tokens = bindings[i + 1];
            var value = processBinding(name, tokens, node, model);
            var binding = node.bind(name, value, tokens.onlyOneTime);
            if (binding && instanceBindings)
                instanceBindings.push(binding)
        }
        node.bindFinished();
        if (!bindings.isTemplate)
            return;
        node.model_ = model;
        var iter = node.processBindingDirectives_(bindings);
        if (instanceBindings && iter)
            instanceBindings.push(iter)
    }
    function parseWithDefault(el, name, prepareBindingFn) {
        var v = el.getAttribute(name);
        return parseMustaches(v == "" ? "{{}}" : v, name, el, prepareBindingFn)
    }
    function parseAttributeBindings(element, prepareBindingFn) {
        assert(element);
        var bindings = [];
        var ifFound = false;
        var bindFound = false;
        for (var i = 0; i < element.attributes.length; i++) {
            var attr = element.attributes[i];
            var name = attr.name;
            var value = attr.value;
            while (name[0] === "_") {
                name = name.substring(1)
            }
            if (isTemplate(element) && (name === IF || name === BIND || name === REPEAT)) {
                continue
            }
            var tokens = parseMustaches(value, name, element, prepareBindingFn);
            if (!tokens)
                continue;bindings.push(name, tokens)
        }
        if (isTemplate(element)) {
            bindings.isTemplate = true;
            bindings.if = parseWithDefault(element, IF, prepareBindingFn);
            bindings.bind = parseWithDefault(element, BIND, prepareBindingFn);
            bindings.repeat = parseWithDefault(element, REPEAT, prepareBindingFn);
            if (bindings.if && !bindings.bind && !bindings.repeat)
                bindings.bind = parseMustaches("{{}}", BIND, element, prepareBindingFn)
        }
        return bindings
    }
    function getBindings(node, prepareBindingFn) {
        if (node.nodeType === Node.ELEMENT_NODE)
            return parseAttributeBindings(node, prepareBindingFn);
        if (node.nodeType === Node.TEXT_NODE) {
            var tokens = parseMustaches(node.data, "textContent", node, prepareBindingFn);
            if (tokens)
                return ["textContent", tokens]
        }
        return []
    }
    function cloneAndBindInstance(node, parent, stagingDocument, bindings, model, delegate, instanceBindings, instanceRecord) {
        var clone = parent.appendChild(stagingDocument.importNode(node, false));
        var i = 0;
        for (var child = node.firstChild; child; child = child.nextSibling) {
            cloneAndBindInstance(child, clone, stagingDocument, bindings.children[i++], model, delegate, instanceBindings)
        }
        if (bindings.isTemplate) {
            HTMLTemplateElement.decorate(clone, node);
            if (delegate)
                clone.setDelegate_(delegate)
        }
        processBindings(clone, bindings, model, instanceBindings);
        return clone
    }
    function createInstanceBindingMap(node, prepareBindingFn) {
        var map = getBindings(node, prepareBindingFn);
        map.children = {};
        var index = 0;
        for (var child = node.firstChild; child; child = child.nextSibling) {
            map.children[index++] = createInstanceBindingMap(child, prepareBindingFn)
        }
        return map
    }
    var contentUidCounter = 1;
    function getContentUid(content) {
        var id = content.id_;
        if (!id)
            id = content.id_ = contentUidCounter++;
        return id
    }
    function getInstanceBindingMap(content, delegate_) {
        var contentId = getContentUid(content);
        if (delegate_) {
            var map = delegate_.bindingMaps[contentId];
            if (!map) {
                map = delegate_.bindingMaps[contentId] = createInstanceBindingMap(content, delegate_.prepareBinding) || []
            }
            return map
        }
        var map = content.bindingMap_;
        if (!map) {
            map = content.bindingMap_ = createInstanceBindingMap(content, undefined) || []
        }
        return map
    }
    Object.defineProperty(Node.prototype, "templateInstance", {
        get: function() {
            var instance = this.templateInstance_;
            return instance ? instance : this.parentNode ? this.parentNode.templateInstance : undefined
        }
    });
    var emptyInstance = document.createDocumentFragment();
    emptyInstance.bindings_ = [];
    emptyInstance.terminator_ = null ;
    function TemplateIterator(templateElement) {
        this.closed = false;
        this.templateElement_ = templateElement;
        this.instances = [];
        this.deps = undefined;
        this.iteratedValue = [];
        this.presentValue = undefined;
        this.arrayObserver = undefined
    }
    TemplateIterator.prototype = {
        closeDeps: function() {
            var deps = this.deps;
            if (deps) {
                if (deps.ifOneTime === false)
                    deps.ifValue.close();
                if (deps.oneTime === false)
                    deps.value.close()
            }
        },
        updateDependencies: function(directives, model) {
            this.closeDeps();
            var deps = this.deps = {};
            var template = this.templateElement_;
            var ifValue = true;
            if (directives.if) {
                deps.hasIf = true;
                deps.ifOneTime = directives.if.onlyOneTime;
                deps.ifValue = processBinding(IF, directives.if, template, model);
                ifValue = deps.ifValue;
                if (deps.ifOneTime && !ifValue) {
                    this.valueChanged();
                    return
                }
                if (!deps.ifOneTime)
                    ifValue = ifValue.open(this.updateIfValue, this)
            }
            if (directives.repeat) {
                deps.repeat = true;
                deps.oneTime = directives.repeat.onlyOneTime;
                deps.value = processBinding(REPEAT, directives.repeat, template, model)
            } else {
                deps.repeat = false;
                deps.oneTime = directives.bind.onlyOneTime;
                deps.value = processBinding(BIND, directives.bind, template, model)
            }
            var value = deps.value;
            if (!deps.oneTime)
                value = value.open(this.updateIteratedValue, this);
            if (!ifValue) {
                this.valueChanged();
                return
            }
            this.updateValue(value)
        },
        getUpdatedValue: function() {
            var value = this.deps.value;
            if (!this.deps.oneTime)
                value = value.discardChanges();
            return value
        },
        updateIfValue: function(ifValue) {
            if (!ifValue) {
                this.valueChanged();
                return
            }
            this.updateValue(this.getUpdatedValue())
        },
        updateIteratedValue: function(value) {
            if (this.deps.hasIf) {
                var ifValue = this.deps.ifValue;
                if (!this.deps.ifOneTime)
                    ifValue = ifValue.discardChanges();
                if (!ifValue) {
                    this.valueChanged();
                    return
                }
            }
            this.updateValue(value)
        },
        updateValue: function(value) {
            if (!this.deps.repeat)
                value = [value];
            var observe = this.deps.repeat && !this.deps.oneTime && Array.isArray(value);
            this.valueChanged(value, observe)
        },
        valueChanged: function(value, observeValue) {
            if (!Array.isArray(value))
                value = [];
            if (value === this.iteratedValue)
                return;
            this.unobserve();
            this.presentValue = value;
            if (observeValue) {
                this.arrayObserver = new ArrayObserver(this.presentValue);
                this.arrayObserver.open(this.handleSplices, this)
            }
            this.handleSplices(ArrayObserver.calculateSplices(this.presentValue, this.iteratedValue))
        },
        getLastInstanceNode: function(index) {
            if (index == -1)
                return this.templateElement_;
            var instance = this.instances[index];
            var terminator = instance.terminator_;
            if (!terminator)
                return this.getLastInstanceNode(index - 1);
            if (terminator.nodeType !== Node.ELEMENT_NODE || this.templateElement_ === terminator) {
                return terminator
            }
            var subtemplateIterator = terminator.iterator_;
            if (!subtemplateIterator)
                return terminator;
            return subtemplateIterator.getLastTemplateNode()
        },
        getLastTemplateNode: function() {
            return this.getLastInstanceNode(this.instances.length - 1)
        },
        insertInstanceAt: function(index, fragment) {
            var previousInstanceLast = this.getLastInstanceNode(index - 1);
            var parent = this.templateElement_.parentNode;
            this.instances.splice(index, 0, fragment);
            parent.insertBefore(fragment, previousInstanceLast.nextSibling)
        },
        extractInstanceAt: function(index) {
            var previousInstanceLast = this.getLastInstanceNode(index - 1);
            var lastNode = this.getLastInstanceNode(index);
            var parent = this.templateElement_.parentNode;
            var instance = this.instances.splice(index, 1)[0];
            while (lastNode !== previousInstanceLast) {
                var node = previousInstanceLast.nextSibling;
                if (node == lastNode)
                    lastNode = previousInstanceLast;
                instance.appendChild(parent.removeChild(node))
            }
            return instance
        },
        getDelegateFn: function(fn) {
            fn = fn && fn(this.templateElement_);
            return typeof fn === "function" ? fn : null 
        },
        handleSplices: function(splices) {
            if (this.closed || !splices.length)
                return;
            var template = this.templateElement_;
            if (!template.parentNode) {
                this.close();
                return
            }
            ArrayObserver.applySplices(this.iteratedValue, this.presentValue, splices);
            var delegate = template.delegate_;
            if (this.instanceModelFn_ === undefined) {
                this.instanceModelFn_ = this.getDelegateFn(delegate && delegate.prepareInstanceModel)
            }
            if (this.instancePositionChangedFn_ === undefined) {
                this.instancePositionChangedFn_ = this.getDelegateFn(delegate && delegate.prepareInstancePositionChanged)
            }
            var instanceCache = new Map;
            var removeDelta = 0;
            for (var i = 0; i < splices.length; i++) {
                var splice = splices[i];
                var removed = splice.removed;
                for (var j = 0; j < removed.length; j++) {
                    var model = removed[j];
                    var instance = this.extractInstanceAt(splice.index + removeDelta);
                    if (instance !== emptyInstance) {
                        instanceCache.set(model, instance)
                    }
                }
                removeDelta -= splice.addedCount
            }
            for (var i = 0; i < splices.length; i++) {
                var splice = splices[i];
                var addIndex = splice.index;
                for (; addIndex < splice.index + splice.addedCount; addIndex++) {
                    var model = this.iteratedValue[addIndex];
                    var instance = instanceCache.get(model);
                    if (instance) {
                        instanceCache.delete(model)
                    } else {
                        if (this.instanceModelFn_) {
                            model = this.instanceModelFn_(model)
                        }
                        if (model === undefined) {
                            instance = emptyInstance
                        } else {
                            instance = template.createInstance(model, undefined, delegate)
                        }
                    }
                    this.insertInstanceAt(addIndex, instance)
                }
            }
            instanceCache.forEach(function(instance) {
                this.closeInstanceBindings(instance)
            }
            , this);
            if (this.instancePositionChangedFn_)
                this.reportInstancesMoved(splices)
        },
        reportInstanceMoved: function(index) {
            var instance = this.instances[index];
            if (instance === emptyInstance)
                return;
            this.instancePositionChangedFn_(instance.templateInstance_, index)
        },
        reportInstancesMoved: function(splices) {
            var index = 0;
            var offset = 0;
            for (var i = 0; i < splices.length; i++) {
                var splice = splices[i];
                if (offset != 0) {
                    while (index < splice.index) {
                        this.reportInstanceMoved(index);
                        index++
                    }
                } else {
                    index = splice.index
                }
                while (index < splice.index + splice.addedCount) {
                    this.reportInstanceMoved(index);
                    index++
                }
                offset += splice.addedCount - splice.removed.length
            }
            if (offset == 0)
                return;
            var length = this.instances.length;
            while (index < length) {
                this.reportInstanceMoved(index);
                index++
            }
        },
        closeInstanceBindings: function(instance) {
            var bindings = instance.bindings_;
            for (var i = 0; i < bindings.length; i++) {
                bindings[i].close()
            }
        },
        unobserve: function() {
            if (!this.arrayObserver)
                return;
            this.arrayObserver.close();
            this.arrayObserver = undefined
        },
        close: function() {
            if (this.closed)
                return;
            this.unobserve();
            for (var i = 0; i < this.instances.length; i++) {
                this.closeInstanceBindings(this.instances[i])
            }
            this.instances.length = 0;
            this.closeDeps();
            this.templateElement_.iterator_ = undefined;
            this.closed = true
        }
    };
    HTMLTemplateElement.forAllTemplatesFrom_ = forAllTemplatesFrom
}
)(this);
(function(scope) {
    "use strict";
    var hasWorkingUrl = false;
    if (!scope.forceJURL) {
        try {
            var u = new URL("b","http://a");
            u.pathname = "c%20d";
            hasWorkingUrl = u.href === "http://a/c%20d"
        } catch (e) {}
    }
    if (hasWorkingUrl)
        return;
    var relative = Object.create(null );
    relative["ftp"] = 21;
    relative["file"] = 0;
    relative["gopher"] = 70;
    relative["http"] = 80;
    relative["https"] = 443;
    relative["ws"] = 80;
    relative["wss"] = 443;
    var relativePathDotMapping = Object.create(null );
    relativePathDotMapping["%2e"] = ".";
    relativePathDotMapping[".%2e"] = "..";
    relativePathDotMapping["%2e."] = "..";
    relativePathDotMapping["%2e%2e"] = "..";
    function isRelativeScheme(scheme) {
        return relative[scheme] !== undefined
    }
    function invalid() {
        clear.call(this);
        this._isInvalid = true
    }
    function IDNAToASCII(h) {
        if ("" == h) {
            invalid.call(this)
        }
        return h.toLowerCase()
    }
    function percentEscape(c) {
        var unicode = c.charCodeAt(0);
        if (unicode > 32 && unicode < 127 && [34, 35, 60, 62, 63, 96].indexOf(unicode) == -1) {
            return c
        }
        return encodeURIComponent(c)
    }
    function percentEscapeQuery(c) {
        var unicode = c.charCodeAt(0);
        if (unicode > 32 && unicode < 127 && [34, 35, 60, 62, 96].indexOf(unicode) == -1) {
            return c
        }
        return encodeURIComponent(c)
    }
    var EOF = undefined
      , ALPHA = /[a-zA-Z]/
      , ALPHANUMERIC = /[a-zA-Z0-9\+\-\.]/;
    function parse(input, stateOverride, base) {
        function err(message) {
            errors.push(message)
        }
        var state = stateOverride || "scheme start"
          , cursor = 0
          , buffer = ""
          , seenAt = false
          , seenBracket = false
          , errors = [];
        loop: while ((input[cursor - 1] != EOF || cursor == 0) && !this._isInvalid) {
            var c = input[cursor];
            switch (state) {
            case "scheme start":
                if (c && ALPHA.test(c)) {
                    buffer += c.toLowerCase();
                    state = "scheme"
                } else if (!stateOverride) {
                    buffer = "";
                    state = "no scheme";
                    continue
                } else {
                    err("Invalid scheme.");
                    break loop
                }
                break;
            case "scheme":
                if (c && ALPHANUMERIC.test(c)) {
                    buffer += c.toLowerCase()
                } else if (":" == c) {
                    this._scheme = buffer;
                    buffer = "";
                    if (stateOverride) {
                        break loop
                    }
                    if (isRelativeScheme(this._scheme)) {
                        this._isRelative = true
                    }
                    if ("file" == this._scheme) {
                        state = "relative"
                    } else if (this._isRelative && base && base._scheme == this._scheme) {
                        state = "relative or authority"
                    } else if (this._isRelative) {
                        state = "authority first slash"
                    } else {
                        state = "scheme data"
                    }
                } else if (!stateOverride) {
                    buffer = "";
                    cursor = 0;
                    state = "no scheme";
                    continue
                } else if (EOF == c) {
                    break loop
                } else {
                    err("Code point not allowed in scheme: " + c);
                    break loop
                }
                break;
            case "scheme data":
                if ("?" == c) {
                    query = "?";
                    state = "query"
                } else if ("#" == c) {
                    this._fragment = "#";
                    state = "fragment"
                } else {
                    if (EOF != c && "	" != c && "\n" != c && "\r" != c) {
                        this._schemeData += percentEscape(c)
                    }
                }
                break;
            case "no scheme":
                if (!base || !isRelativeScheme(base._scheme)) {
                    err("Missing scheme.");
                    invalid.call(this)
                } else {
                    state = "relative";
                    continue
                }
                break;
            case "relative or authority":
                if ("/" == c && "/" == input[cursor + 1]) {
                    state = "authority ignore slashes"
                } else {
                    err("Expected /, got: " + c);
                    state = "relative";
                    continue
                }
                break;
            case "relative":
                this._isRelative = true;
                if ("file" != this._scheme)
                    this._scheme = base._scheme;
                if (EOF == c) {
                    this._host = base._host;
                    this._port = base._port;
                    this._path = base._path.slice();
                    this._query = base._query;
                    break loop
                } else if ("/" == c || "\\" == c) {
                    if ("\\" == c)
                        err("\\ is an invalid code point.");
                    state = "relative slash"
                } else if ("?" == c) {
                    this._host = base._host;
                    this._port = base._port;
                    this._path = base._path.slice();
                    this._query = "?";
                    state = "query"
                } else if ("#" == c) {
                    this._host = base._host;
                    this._port = base._port;
                    this._path = base._path.slice();
                    this._query = base._query;
                    this._fragment = "#";
                    state = "fragment"
                } else {
                    var nextC = input[cursor + 1];
                    var nextNextC = input[cursor + 2];
                    if ("file" != this._scheme || !ALPHA.test(c) || nextC != ":" && nextC != "|" || EOF != nextNextC && "/" != nextNextC && "\\" != nextNextC && "?" != nextNextC && "#" != nextNextC) {
                        this._host = base._host;
                        this._port = base._port;
                        this._path = base._path.slice();
                        this._path.pop()
                    }
                    state = "relative path";
                    continue
                }
                break;
            case "relative slash":
                if ("/" == c || "\\" == c) {
                    if ("\\" == c) {
                        err("\\ is an invalid code point.")
                    }
                    if ("file" == this._scheme) {
                        state = "file host"
                    } else {
                        state = "authority ignore slashes"
                    }
                } else {
                    if ("file" != this._scheme) {
                        this._host = base._host;
                        this._port = base._port
                    }
                    state = "relative path";
                    continue
                }
                break;
            case "authority first slash":
                if ("/" == c) {
                    state = "authority second slash"
                } else {
                    err("Expected '/', got: " + c);
                    state = "authority ignore slashes";
                    continue
                }
                break;
            case "authority second slash":
                state = "authority ignore slashes";
                if ("/" != c) {
                    err("Expected '/', got: " + c);
                    continue
                }
                break;
            case "authority ignore slashes":
                if ("/" != c && "\\" != c) {
                    state = "authority";
                    continue
                } else {
                    err("Expected authority, got: " + c)
                }
                break;
            case "authority":
                if ("@" == c) {
                    if (seenAt) {
                        err("@ already seen.");
                        buffer += "%40"
                    }
                    seenAt = true;
                    for (var i = 0; i < buffer.length; i++) {
                        var cp = buffer[i];
                        if ("	" == cp || "\n" == cp || "\r" == cp) {
                            err("Invalid whitespace in authority.");
                            continue
                        }
                        if (":" == cp && null  === this._password) {
                            this._password = "";
                            continue
                        }
                        var tempC = percentEscape(cp);
                        null  !== this._password ? this._password += tempC : this._username += tempC
                    }
                    buffer = ""
                } else if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c) {
                    cursor -= buffer.length;
                    buffer = "";
                    state = "host";
                    continue
                } else {
                    buffer += c
                }
                break;
            case "file host":
                if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c) {
                    if (buffer.length == 2 && ALPHA.test(buffer[0]) && (buffer[1] == ":" || buffer[1] == "|")) {
                        state = "relative path"
                    } else if (buffer.length == 0) {
                        state = "relative path start"
                    } else {
                        this._host = IDNAToASCII.call(this, buffer);
                        buffer = "";
                        state = "relative path start"
                    }
                    continue
                } else if ("	" == c || "\n" == c || "\r" == c) {
                    err("Invalid whitespace in file host.")
                } else {
                    buffer += c
                }
                break;
            case "host":
            case "hostname":
                if (":" == c && !seenBracket) {
                    this._host = IDNAToASCII.call(this, buffer);
                    buffer = "";
                    state = "port";
                    if ("hostname" == stateOverride) {
                        break loop
                    }
                } else if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c) {
                    this._host = IDNAToASCII.call(this, buffer);
                    buffer = "";
                    state = "relative path start";
                    if (stateOverride) {
                        break loop
                    }
                    continue
                } else if ("	" != c && "\n" != c && "\r" != c) {
                    if ("[" == c) {
                        seenBracket = true
                    } else if ("]" == c) {
                        seenBracket = false
                    }
                    buffer += c
                } else {
                    err("Invalid code point in host/hostname: " + c)
                }
                break;
            case "port":
                if (/[0-9]/.test(c)) {
                    buffer += c
                } else if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c || stateOverride) {
                    if ("" != buffer) {
                        var temp = parseInt(buffer, 10);
                        if (temp != relative[this._scheme]) {
                            this._port = temp + ""
                        }
                        buffer = ""
                    }
                    if (stateOverride) {
                        break loop
                    }
                    state = "relative path start";
                    continue
                } else if ("	" == c || "\n" == c || "\r" == c) {
                    err("Invalid code point in port: " + c)
                } else {
                    invalid.call(this)
                }
                break;
            case "relative path start":
                if ("\\" == c)
                    err("'\\' not allowed in path.");
                state = "relative path";
                if ("/" != c && "\\" != c) {
                    continue
                }
                break;
            case "relative path":
                if (EOF == c || "/" == c || "\\" == c || !stateOverride && ("?" == c || "#" == c)) {
                    if ("\\" == c) {
                        err("\\ not allowed in relative path.")
                    }
                    var tmp;
                    if (tmp = relativePathDotMapping[buffer.toLowerCase()]) {
                        buffer = tmp
                    }
                    if (".." == buffer) {
                        this._path.pop();
                        if ("/" != c && "\\" != c) {
                            this._path.push("")
                        }
                    } else if ("." == buffer && "/" != c && "\\" != c) {
                        this._path.push("")
                    } else if ("." != buffer) {
                        if ("file" == this._scheme && this._path.length == 0 && buffer.length == 2 && ALPHA.test(buffer[0]) && buffer[1] == "|") {
                            buffer = buffer[0] + ":"
                        }
                        this._path.push(buffer)
                    }
                    buffer = "";
                    if ("?" == c) {
                        this._query = "?";
                        state = "query"
                    } else if ("#" == c) {
                        this._fragment = "#";
                        state = "fragment"
                    }
                } else if ("	" != c && "\n" != c && "\r" != c) {
                    buffer += percentEscape(c)
                }
                break;
            case "query":
                if (!stateOverride && "#" == c) {
                    this._fragment = "#";
                    state = "fragment"
                } else if (EOF != c && "	" != c && "\n" != c && "\r" != c) {
                    this._query += percentEscapeQuery(c)
                }
                break;
            case "fragment":
                if (EOF != c && "	" != c && "\n" != c && "\r" != c) {
                    this._fragment += c
                }
                break
            }
            cursor++
        }
    }
    function clear() {
        this._scheme = "";
        this._schemeData = "";
        this._username = "";
        this._password = null ;
        this._host = "";
        this._port = "";
        this._path = [];
        this._query = "";
        this._fragment = "";
        this._isInvalid = false;
        this._isRelative = false
    }
    function jURL(url, base) {
        if (base !== undefined && !(base instanceof jURL))
            base = new jURL(String(base));
        this._url = url;
        clear.call(this);
        var input = url.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, "");
        parse.call(this, input, null , base)
    }
    jURL.prototype = {
        get href() {
            if (this._isInvalid)
                return this._url;
            var authority = "";
            if ("" != this._username || null  != this._password) {
                authority = this._username + (null  != this._password ? ":" + this._password : "") + "@"
            }
            return this.protocol + (this._isRelative ? "//" + authority + this.host : "") + this.pathname + this._query + this._fragment
        },
        set href(href) {
            clear.call(this);
            parse.call(this, href)
        },
        get protocol() {
            return this._scheme + ":"
        },
        set protocol(protocol) {
            if (this._isInvalid)
                return;
            parse.call(this, protocol + ":", "scheme start")
        },
        get host() {
            return this._isInvalid ? "" : this._port ? this._host + ":" + this._port : this._host
        },
        set host(host) {
            if (this._isInvalid || !this._isRelative)
                return;
            parse.call(this, host, "host")
        },
        get hostname() {
            return this._host
        },
        set hostname(hostname) {
            if (this._isInvalid || !this._isRelative)
                return;
            parse.call(this, hostname, "hostname")
        },
        get port() {
            return this._port
        },
        set port(port) {
            if (this._isInvalid || !this._isRelative)
                return;
            parse.call(this, port, "port")
        },
        get pathname() {
            return this._isInvalid ? "" : this._isRelative ? "/" + this._path.join("/") : this._schemeData
        },
        set pathname(pathname) {
            if (this._isInvalid || !this._isRelative)
                return;
            this._path = [];
            parse.call(this, pathname, "relative path start")
        },
        get search() {
            return this._isInvalid || !this._query || "?" == this._query ? "" : this._query
        },
        set search(search) {
            if (this._isInvalid || !this._isRelative)
                return;
            this._query = "?";
            if ("?" == search[0])
                search = search.slice(1);
            parse.call(this, search, "query")
        },
        get hash() {
            return this._isInvalid || !this._fragment || "#" == this._fragment ? "" : this._fragment
        },
        set hash(hash) {
            if (this._isInvalid)
                return;
            this._fragment = "#";
            if ("#" == hash[0])
                hash = hash.slice(1);
            parse.call(this, hash, "fragment")
        },
        get origin() {
            var host;
            if (this._isInvalid || !this._scheme) {
                return ""
            }
            switch (this._scheme) {
            case "data":
            case "file":
            case "javascript":
            case "mailto":
                return "null"
            }
            host = this.host;
            if (!host) {
                return ""
            }
            return this._scheme + "://" + host
        }
    };
    var OriginalURL = scope.URL;
    if (OriginalURL) {
        jURL.createObjectURL = function(blob) {
            return OriginalURL.createObjectURL.apply(OriginalURL, arguments)
        }
        ;
        jURL.revokeObjectURL = function(url) {
            OriginalURL.revokeObjectURL(url)
        }
    }
    scope.URL = jURL
}
)(this);
(function(scope) {
    var iterations = 0;
    var callbacks = [];
    var twiddle = document.createTextNode("");
    function endOfMicrotask(callback) {
        twiddle.textContent = iterations++;
        callbacks.push(callback)
    }
    function atEndOfMicrotask() {
        while (callbacks.length) {
            callbacks.shift()()
        }
    }
    new (window.MutationObserver || JsMutationObserver)(atEndOfMicrotask).observe(twiddle, {
        characterData: true
    });
    scope.endOfMicrotask = endOfMicrotask;
    Platform.endOfMicrotask = endOfMicrotask
}
)(Polymer);
(function(scope) {
    var endOfMicrotask = scope.endOfMicrotask;
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var style = document.createElement("style");
    style.textContent = "template {display: none !important;} /* injected by platform.js */";
    var head = document.querySelector("head");
    head.insertBefore(style, head.firstChild);
    var flushing;
    function flush() {
        if (!flushing) {
            flushing = true;
            endOfMicrotask(function() {
                flushing = false;
                log.data && console.group("flush");
                Platform.performMicrotaskCheckpoint();
                log.data && console.groupEnd()
            }
            )
        }
    }
    if (!Observer.hasObjectObserve) {
        var FLUSH_POLL_INTERVAL = 125;
        window.addEventListener("WebComponentsReady", function() {
            flush();
            var visibilityHandler = function() {
                if (document.visibilityState === "hidden") {
                    if (scope.flushPoll) {
                        clearInterval(scope.flushPoll)
                    }
                } else {
                    scope.flushPoll = setInterval(flush, FLUSH_POLL_INTERVAL)
                }
            }
            ;
            if (typeof document.visibilityState === "string") {
                document.addEventListener("visibilitychange", visibilityHandler)
            }
            visibilityHandler()
        }
        )
    } else {
        flush = function() {}
    }
    if (window.CustomElements && !CustomElements.useNative) {
        var originalImportNode = Document.prototype.importNode;
        Document.prototype.importNode = function(node, deep) {
            var imported = originalImportNode.call(this, node, deep);
            CustomElements.upgradeAll(imported);
            return imported
        }
    }
    scope.flush = flush;
    Platform.flush = flush
}
)(window.Polymer);
(function(scope) {
    var urlResolver = {
        resolveDom: function(root, url) {
            url = url || baseUrl(root);
            this.resolveAttributes(root, url);
            this.resolveStyles(root, url);
            var templates = root.querySelectorAll("template");
            if (templates) {
                for (var i = 0, l = templates.length, t; i < l && (t = templates[i]); i++) {
                    if (t.content) {
                        this.resolveDom(t.content, url)
                    }
                }
            }
        },
        resolveTemplate: function(template) {
            this.resolveDom(template.content, baseUrl(template))
        },
        resolveStyles: function(root, url) {
            var styles = root.querySelectorAll("style");
            if (styles) {
                for (var i = 0, l = styles.length, s; i < l && (s = styles[i]); i++) {
                    this.resolveStyle(s, url)
                }
            }
        },
        resolveStyle: function(style, url) {
            url = url || baseUrl(style);
            style.textContent = this.resolveCssText(style.textContent, url)
        },
        resolveCssText: function(cssText, baseUrl, keepAbsolute) {
            cssText = replaceUrlsInCssText(cssText, baseUrl, keepAbsolute, CSS_URL_REGEXP);
            return replaceUrlsInCssText(cssText, baseUrl, keepAbsolute, CSS_IMPORT_REGEXP)
        },
        resolveAttributes: function(root, url) {
            if (root.hasAttributes && root.hasAttributes()) {
                this.resolveElementAttributes(root, url)
            }
            var nodes = root && root.querySelectorAll(URL_ATTRS_SELECTOR);
            if (nodes) {
                for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
                    this.resolveElementAttributes(n, url)
                }
            }
        },
        resolveElementAttributes: function(node, url) {
            url = url || baseUrl(node);
            URL_ATTRS.forEach(function(v) {
                var attr = node.attributes[v];
                var value = attr && attr.value;
                var replacement;
                if (value && value.search(URL_TEMPLATE_SEARCH) < 0) {
                    if (v === "style") {
                        replacement = replaceUrlsInCssText(value, url, false, CSS_URL_REGEXP)
                    } else {
                        replacement = resolveRelativeUrl(url, value)
                    }
                    attr.value = replacement
                }
            }
            )
        }
    };
    var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
    var CSS_IMPORT_REGEXP = /(@import[\s]+(?!url\())([^;]*)(;)/g;
    var URL_ATTRS = ["href", "src", "action", "style", "url"];
    var URL_ATTRS_SELECTOR = "[" + URL_ATTRS.join("],[") + "]";
    var URL_TEMPLATE_SEARCH = "{{.*}}";
    var URL_HASH = "#";
    function baseUrl(node) {
        var u = new URL(node.ownerDocument.baseURI);
        u.search = "";
        u.hash = "";
        return u
    }
    function replaceUrlsInCssText(cssText, baseUrl, keepAbsolute, regexp) {
        return cssText.replace(regexp, function(m, pre, url, post) {
            var urlPath = url.replace(/["']/g, "");
            urlPath = resolveRelativeUrl(baseUrl, urlPath, keepAbsolute);
            return pre + "'" + urlPath + "'" + post
        }
        )
    }
    function resolveRelativeUrl(baseUrl, url, keepAbsolute) {
        if (url && url[0] === "/") {
            return url
        }
        if (url && url[0] === "#") {
            return url
        }
        var u = new URL(url,baseUrl);
        return keepAbsolute ? u.href : makeDocumentRelPath(u.href)
    }
    function makeDocumentRelPath(url) {
        var root = baseUrl(document.documentElement);
        var u = new URL(url,root);
        if (u.host === root.host && u.port === root.port && u.protocol === root.protocol) {
            return makeRelPath(root, u)
        } else {
            return url
        }
    }
    function makeRelPath(sourceUrl, targetUrl) {
        var source = sourceUrl.pathname;
        var target = targetUrl.pathname;
        var s = source.split("/");
        var t = target.split("/");
        while (s.length && s[0] === t[0]) {
            s.shift();
            t.shift()
        }
        for (var i = 0, l = s.length - 1; i < l; i++) {
            t.unshift("..")
        }
        var hash = targetUrl.href.slice(-1) === URL_HASH ? URL_HASH : targetUrl.hash;
        return t.join("/") + targetUrl.search + hash
    }
    scope.urlResolver = urlResolver
}
)(Polymer);
(function(scope) {
    var endOfMicrotask = Polymer.endOfMicrotask;
    function Loader(regex) {
        this.cache = Object.create(null );
        this.map = Object.create(null );
        this.requests = 0;
        this.regex = regex
    }
    Loader.prototype = {
        extractUrls: function(text, base) {
            var matches = [];
            var matched, u;
            while (matched = this.regex.exec(text)) {
                u = new URL(matched[1],base);
                matches.push({
                    matched: matched[0],
                    url: u.href
                })
            }
            return matches
        },
        process: function(text, root, callback) {
            var matches = this.extractUrls(text, root);
            var done = callback.bind(null , this.map);
            this.fetch(matches, done)
        },
        fetch: function(matches, callback) {
            var inflight = matches.length;
            if (!inflight) {
                return callback()
            }
            var done = function() {
                if (--inflight === 0) {
                    callback()
                }
            }
            ;
            var m, req, url;
            for (var i = 0; i < inflight; i++) {
                m = matches[i];
                url = m.url;
                req = this.cache[url];
                if (!req) {
                    req = this.xhr(url);
                    req.match = m;
                    this.cache[url] = req
                }
                req.wait(done)
            }
        },
        handleXhr: function(request) {
            var match = request.match;
            var url = match.url;
            var response = request.response || request.responseText || "";
            this.map[url] = response;
            this.fetch(this.extractUrls(response, url), request.resolve)
        },
        xhr: function(url) {
            this.requests++;
            var request = new XMLHttpRequest;
            request.open("GET", url, true);
            request.send();
            request.onerror = request.onload = this.handleXhr.bind(this, request);
            request.pending = [];
            request.resolve = function() {
                var pending = request.pending;
                for (var i = 0; i < pending.length; i++) {
                    pending[i]()
                }
                request.pending = null 
            }
            ;
            request.wait = function(fn) {
                if (request.pending) {
                    request.pending.push(fn)
                } else {
                    endOfMicrotask(fn)
                }
            }
            ;
            return request
        }
    };
    scope.Loader = Loader
}
)(Polymer);
(function(scope) {
    var urlResolver = scope.urlResolver;
    var Loader = scope.Loader;
    function StyleResolver() {
        this.loader = new Loader(this.regex)
    }
    StyleResolver.prototype = {
        regex: /@import\s+(?:url)?["'\(]*([^'"\)]*)['"\)]*;/g,
        resolve: function(text, url, callback) {
            var done = function(map) {
                callback(this.flatten(text, url, map))
            }
            .bind(this);
            this.loader.process(text, url, done)
        },
        resolveNode: function(style, url, callback) {
            var text = style.textContent;
            var done = function(text) {
                style.textContent = text;
                callback(style)
            }
            ;
            this.resolve(text, url, done)
        },
        flatten: function(text, base, map) {
            var matches = this.loader.extractUrls(text, base);
            var match, url, intermediate;
            for (var i = 0; i < matches.length; i++) {
                match = matches[i];
                url = match.url;
                intermediate = urlResolver.resolveCssText(map[url], url, true);
                intermediate = this.flatten(intermediate, base, map);
                text = text.replace(match.matched, intermediate)
            }
            return text
        },
        loadStyles: function(styles, base, callback) {
            var loaded = 0
              , l = styles.length;
            function loadedStyle(style) {
                loaded++;
                if (loaded === l && callback) {
                    callback()
                }
            }
            for (var i = 0, s; i < l && (s = styles[i]); i++) {
                this.resolveNode(s, base, loadedStyle)
            }
        }
    };
    var styleResolver = new StyleResolver;
    scope.styleResolver = styleResolver
}
)(Polymer);
(function(scope) {
    function extend(prototype, api) {
        if (prototype && api) {
            Object.getOwnPropertyNames(api).forEach(function(n) {
                var pd = Object.getOwnPropertyDescriptor(api, n);
                if (pd) {
                    Object.defineProperty(prototype, n, pd);
                    if (typeof pd.value == "function") {
                        pd.value.nom = n
                    }
                }
            }
            )
        }
        return prototype
    }
    function mixin(inObj) {
        var obj = inObj || {};
        for (var i = 1; i < arguments.length; i++) {
            var p = arguments[i];
            try {
                for (var n in p) {
                    copyProperty(n, p, obj)
                }
            } catch (x) {}
        }
        return obj
    }
    function copyProperty(inName, inSource, inTarget) {
        var pd = getPropertyDescriptor(inSource, inName);
        Object.defineProperty(inTarget, inName, pd)
    }
    function getPropertyDescriptor(inObject, inName) {
        if (inObject) {
            var pd = Object.getOwnPropertyDescriptor(inObject, inName);
            return pd || getPropertyDescriptor(Object.getPrototypeOf(inObject), inName)
        }
    }
    scope.extend = extend;
    scope.mixin = mixin;
    Platform.mixin = mixin
}
)(Polymer);
(function(scope) {
    var Job = function(inContext) {
        this.context = inContext;
        this.boundComplete = this.complete.bind(this)
    }
    ;
    Job.prototype = {
        go: function(callback, wait) {
            this.callback = callback;
            var h;
            if (!wait) {
                h = requestAnimationFrame(this.boundComplete);
                this.handle = function() {
                    cancelAnimationFrame(h)
                }
            } else {
                h = setTimeout(this.boundComplete, wait);
                this.handle = function() {
                    clearTimeout(h)
                }
            }
        },
        stop: function() {
            if (this.handle) {
                this.handle();
                this.handle = null 
            }
        },
        complete: function() {
            if (this.handle) {
                this.stop();
                this.callback.call(this.context)
            }
        }
    };
    function job(job, callback, wait) {
        if (job) {
            job.stop()
        } else {
            job = new Job(this)
        }
        job.go(callback, wait);
        return job
    }
    scope.job = job
}
)(Polymer);
(function(scope) {
    var registry = {};
    HTMLElement.register = function(tag, prototype) {
        registry[tag] = prototype
    }
    ;
    HTMLElement.getPrototypeForTag = function(tag) {
        var prototype = !tag ? HTMLElement.prototype : registry[tag];
        return prototype || Object.getPrototypeOf(document.createElement(tag))
    }
    ;
    var originalStopPropagation = Event.prototype.stopPropagation;
    Event.prototype.stopPropagation = function() {
        this.cancelBubble = true;
        originalStopPropagation.apply(this, arguments)
    }
    ;
    var add = DOMTokenList.prototype.add;
    var remove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.add = function() {
        for (var i = 0; i < arguments.length; i++) {
            add.call(this, arguments[i])
        }
    }
    ;
    DOMTokenList.prototype.remove = function() {
        for (var i = 0; i < arguments.length; i++) {
            remove.call(this, arguments[i])
        }
    }
    ;
    DOMTokenList.prototype.toggle = function(name, bool) {
        if (arguments.length == 1) {
            bool = !this.contains(name)
        }
        bool ? this.add(name) : this.remove(name)
    }
    ;
    DOMTokenList.prototype.switch = function(oldName, newName) {
        oldName && this.remove(oldName);
        newName && this.add(newName)
    }
    ;
    var ArraySlice = function() {
        return Array.prototype.slice.call(this)
    }
    ;
    var namedNodeMap = window.NamedNodeMap || window.MozNamedAttrMap || {};
    NodeList.prototype.array = ArraySlice;
    namedNodeMap.prototype.array = ArraySlice;
    HTMLCollection.prototype.array = ArraySlice;
    function createDOM(inTagOrNode, inHTML, inAttrs) {
        var dom = typeof inTagOrNode == "string" ? document.createElement(inTagOrNode) : inTagOrNode.cloneNode(true);
        dom.innerHTML = inHTML;
        if (inAttrs) {
            for (var n in inAttrs) {
                dom.setAttribute(n, inAttrs[n])
            }
        }
        return dom
    }
    scope.createDOM = createDOM
}
)(Polymer);
(function(scope) {
    function $super(arrayOfArgs) {
        var caller = $super.caller;
        var nom = caller.nom;
        var _super = caller._super;
        if (!_super) {
            if (!nom) {
                nom = caller.nom = nameInThis.call(this, caller)
            }
            if (!nom) {
                console.warn("called super() on a method not installed declaratively (has no .nom property)")
            }
            _super = memoizeSuper(caller, nom, getPrototypeOf(this))
        }
        var fn = _super[nom];
        if (fn) {
            if (!fn._super) {
                memoizeSuper(fn, nom, _super)
            }
            return fn.apply(this, arrayOfArgs || [])
        }
    }
    function nameInThis(value) {
        var p = this.__proto__;
        while (p && p !== HTMLElement.prototype) {
            var n$ = Object.getOwnPropertyNames(p);
            for (var i = 0, l = n$.length, n; i < l && (n = n$[i]); i++) {
                var d = Object.getOwnPropertyDescriptor(p, n);
                if (typeof d.value === "function" && d.value === value) {
                    return n
                }
            }
            p = p.__proto__
        }
    }
    function memoizeSuper(method, name, proto) {
        var s = nextSuper(proto, name, method);
        if (s[name]) {
            s[name].nom = name
        }
        return method._super = s
    }
    function nextSuper(proto, name, caller) {
        while (proto) {
            if (proto[name] !== caller && proto[name]) {
                return proto
            }
            proto = getPrototypeOf(proto)
        }
        return Object
    }
    function getPrototypeOf(prototype) {
        return prototype.__proto__
    }
    function hintSuper(prototype) {
        for (var n in prototype) {
            var pd = Object.getOwnPropertyDescriptor(prototype, n);
            if (pd && typeof pd.value === "function") {
                pd.value.nom = n
            }
        }
    }
    scope.super = $super
}
)(Polymer);
(function(scope) {
    function noopHandler(value) {
        return value
    }
    var typeHandlers = {
        string: noopHandler,
        undefined: noopHandler,
        date: function(value) {
            return new Date(Date.parse(value) || Date.now())
        },
        "boolean": function(value) {
            if (value === "") {
                return true
            }
            return value === "false" ? false : !!value
        },
        number: function(value) {
            var n = parseFloat(value);
            if (n === 0) {
                n = parseInt(value)
            }
            return isNaN(n) ? value : n
        },
        object: function(value, currentValue) {
            if (currentValue === null ) {
                return value
            }
            try {
                return JSON.parse(value.replace(/'/g, '"'))
            } catch (e) {
                return value
            }
        },
        "function": function(value, currentValue) {
            return currentValue
        }
    };
    function deserializeValue(value, currentValue) {
        var inferredType = typeof currentValue;
        if (currentValue instanceof Date) {
            inferredType = "date"
        }
        return typeHandlers[inferredType](value, currentValue)
    }
    scope.deserializeValue = deserializeValue
}
)(Polymer);
(function(scope) {
    var extend = scope.extend;
    var api = {};
    api.declaration = {};
    api.instance = {};
    api.publish = function(apis, prototype) {
        for (var n in apis) {
            extend(prototype, apis[n])
        }
    }
    ;
    scope.api = api
}
)(Polymer);
(function(scope) {
    var utils = {
        async: function(method, args, timeout) {
            Polymer.flush();
            args = args && args.length ? args : [args];
            var fn = function() {
                (this[method] || method).apply(this, args)
            }
            .bind(this);
            var handle = timeout ? setTimeout(fn, timeout) : requestAnimationFrame(fn);
            return timeout ? handle : ~handle
        },
        cancelAsync: function(handle) {
            if (handle < 0) {
                cancelAnimationFrame(~handle)
            } else {
                clearTimeout(handle)
            }
        },
        fire: function(type, detail, onNode, bubbles, cancelable) {
            var node = onNode || this;
            detail = detail === null  || detail === undefined ? {} : detail;
            var event = new CustomEvent(type,{
                bubbles: bubbles !== undefined ? bubbles : true,
                cancelable: cancelable !== undefined ? cancelable : true,
                detail: detail
            });
            node.dispatchEvent(event);
            return event
        },
        asyncFire: function() {
            this.async("fire", arguments)
        },
        classFollows: function(anew, old, className) {
            if (old) {
                old.classList.remove(className)
            }
            if (anew) {
                anew.classList.add(className)
            }
        },
        injectBoundHTML: function(html, element) {
            var template = document.createElement("template");
            template.innerHTML = html;
            var fragment = this.instanceTemplate(template);
            if (element) {
                element.textContent = "";
                element.appendChild(fragment)
            }
            return fragment
        }
    };
    var nop = function() {}
    ;
    var nob = {};
    utils.asyncMethod = utils.async;
    scope.api.instance.utils = utils;
    scope.nop = nop;
    scope.nob = nob
}
)(Polymer);
(function(scope) {
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var EVENT_PREFIX = "on-";
    var events = {
        EVENT_PREFIX: EVENT_PREFIX,
        addHostListeners: function() {
            var events = this.eventDelegates;
            log.events && Object.keys(events).length > 0 && console.log("[%s] addHostListeners:", this.localName, events);
            for (var type in events) {
                var methodName = events[type];
                PolymerGestures.addEventListener(this, type, this.element.getEventHandler(this, this, methodName))
            }
        },
        dispatchMethod: function(obj, method, args) {
            if (obj) {
                log.events && console.group("[%s] dispatch [%s]", obj.localName, method);
                var fn = typeof method === "function" ? method : obj[method];
                if (fn) {
                    fn[args ? "apply" : "call"](obj, args)
                }
                log.events && console.groupEnd();
                Polymer.flush()
            }
        }
    };
    scope.api.instance.events = events;
    scope.addEventListener = function(node, eventType, handlerFn, capture) {
        PolymerGestures.addEventListener(wrap(node), eventType, handlerFn, capture)
    }
    ;
    scope.removeEventListener = function(node, eventType, handlerFn, capture) {
        PolymerGestures.removeEventListener(wrap(node), eventType, handlerFn, capture)
    }
}
)(Polymer);
(function(scope) {
    var attributes = {
        copyInstanceAttributes: function() {
            var a$ = this._instanceAttributes;
            for (var k in a$) {
                if (!this.hasAttribute(k)) {
                    this.setAttribute(k, a$[k])
                }
            }
        },
        takeAttributes: function() {
            if (this._publishLC) {
                for (var i = 0, a$ = this.attributes, l = a$.length, a; (a = a$[i]) && i < l; i++) {
                    this.attributeToProperty(a.name, a.value)
                }
            }
        },
        attributeToProperty: function(name, value) {
            name = this.propertyForAttribute(name);
            if (name) {
                if (value && value.search(scope.bindPattern) >= 0) {
                    return
                }
                var currentValue = this[name];
                value = this.deserializeValue(value, currentValue);
                if (value !== currentValue) {
                    this[name] = value
                }
            }
        },
        propertyForAttribute: function(name) {
            var match = this._publishLC && this._publishLC[name];
            return match
        },
        deserializeValue: function(stringValue, currentValue) {
            return scope.deserializeValue(stringValue, currentValue)
        },
        serializeValue: function(value, inferredType) {
            if (inferredType === "boolean") {
                return value ? "" : undefined
            } else if (inferredType !== "object" && inferredType !== "function" && value !== undefined) {
                return value
            }
        },
        reflectPropertyToAttribute: function(name) {
            var inferredType = typeof this[name];
            var serializedValue = this.serializeValue(this[name], inferredType);
            if (serializedValue !== undefined) {
                this.setAttribute(name, serializedValue)
            } else if (inferredType === "boolean") {
                this.removeAttribute(name)
            }
        }
    };
    scope.api.instance.attributes = attributes
}
)(Polymer);
(function(scope) {
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var OBSERVE_SUFFIX = "Changed";
    var empty = [];
    var updateRecord = {
        object: undefined,
        type: "update",
        name: undefined,
        oldValue: undefined
    };
    var numberIsNaN = Number.isNaN || function(value) {
        return typeof value === "number" && isNaN(value)
    }
    ;
    function areSameValue(left, right) {
        if (left === right)
            return left !== 0 || 1 / left === 1 / right;
        if (numberIsNaN(left) && numberIsNaN(right))
            return true;
        return left !== left && right !== right
    }
    function resolveBindingValue(oldValue, value) {
        if (value === undefined && oldValue === null ) {
            return value
        }
        return value === null  || value === undefined ? oldValue : value
    }
    var properties = {
        createPropertyObserver: function() {
            var n$ = this._observeNames;
            if (n$ && n$.length) {
                var o = this._propertyObserver = new CompoundObserver(true);
                this.registerObserver(o);
                for (var i = 0, l = n$.length, n; i < l && (n = n$[i]); i++) {
                    o.addPath(this, n);
                    this.observeArrayValue(n, this[n], null )
                }
            }
        },
        openPropertyObserver: function() {
            if (this._propertyObserver) {
                this._propertyObserver.open(this.notifyPropertyChanges, this)
            }
        },
        notifyPropertyChanges: function(newValues, oldValues, paths) {
            var name, method, called = {};
            for (var i in oldValues) {
                name = paths[2 * i + 1];
                method = this.observe[name];
                if (method) {
                    var ov = oldValues[i]
                      , nv = newValues[i];
                    this.observeArrayValue(name, nv, ov);
                    if (!called[method]) {
                        if (ov !== undefined && ov !== null  || nv !== undefined && nv !== null ) {
                            called[method] = true;
                            this.invokeMethod(method, [ov, nv, arguments])
                        }
                    }
                }
            }
        },
        invokeMethod: function(method, args) {
            var fn = this[method] || method;
            if (typeof fn === "function") {
                fn.apply(this, args)
            }
        },
        deliverChanges: function() {
            if (this._propertyObserver) {
                this._propertyObserver.deliver()
            }
        },
        observeArrayValue: function(name, value, old) {
            var callbackName = this.observe[name];
            if (callbackName) {
                if (Array.isArray(old)) {
                    log.observe && console.log("[%s] observeArrayValue: unregister observer [%s]", this.localName, name);
                    this.closeNamedObserver(name + "__array")
                }
                if (Array.isArray(value)) {
                    log.observe && console.log("[%s] observeArrayValue: register observer [%s]", this.localName, name, value);
                    var observer = new ArrayObserver(value);
                    observer.open(function(splices) {
                        this.invokeMethod(callbackName, [splices])
                    }
                    , this);
                    this.registerNamedObserver(name + "__array", observer)
                }
            }
        },
        emitPropertyChangeRecord: function(name, value, oldValue) {
            var object = this;
            if (areSameValue(value, oldValue)) {
                return
            }
            this._propertyChanged(name, value, oldValue);
            if (!Observer.hasObjectObserve) {
                return
            }
            var notifier = this._objectNotifier;
            if (!notifier) {
                notifier = this._objectNotifier = Object.getNotifier(this)
            }
            updateRecord.object = this;
            updateRecord.name = name;
            updateRecord.oldValue = oldValue;
            notifier.notify(updateRecord)
        },
        _propertyChanged: function(name, value, oldValue) {
            if (this.reflect[name]) {
                this.reflectPropertyToAttribute(name)
            }
        },
        bindProperty: function(property, observable, oneTime) {
            if (oneTime) {
                this[property] = observable;
                return
            }
            var computed = this.element.prototype.computed;
            if (computed && computed[property]) {
                var privateComputedBoundValue = property + "ComputedBoundObservable_";
                this[privateComputedBoundValue] = observable;
                return
            }
            return this.bindToAccessor(property, observable, resolveBindingValue)
        },
        bindToAccessor: function(name, observable, resolveFn) {
            var privateName = name + "_";
            var privateObservable = name + "Observable_";
            var privateComputedBoundValue = name + "ComputedBoundObservable_";
            this[privateObservable] = observable;
            var oldValue = this[privateName];
            var self = this;
            function updateValue(value, oldValue) {
                self[privateName] = value;
                var setObserveable = self[privateComputedBoundValue];
                if (setObserveable && typeof setObserveable.setValue == "function") {
                    setObserveable.setValue(value)
                }
                self.emitPropertyChangeRecord(name, value, oldValue)
            }
            var value = observable.open(updateValue);
            if (resolveFn && !areSameValue(oldValue, value)) {
                var resolvedValue = resolveFn(oldValue, value);
                if (!areSameValue(value, resolvedValue)) {
                    value = resolvedValue;
                    if (observable.setValue) {
                        observable.setValue(value)
                    }
                }
            }
            updateValue(value, oldValue);
            var observer = {
                close: function() {
                    observable.close();
                    self[privateObservable] = undefined;
                    self[privateComputedBoundValue] = undefined
                }
            };
            this.registerObserver(observer);
            return observer
        },
        createComputedProperties: function() {
            if (!this._computedNames) {
                return
            }
            for (var i = 0; i < this._computedNames.length; i++) {
                var name = this._computedNames[i];
                var expressionText = this.computed[name];
                try {
                    var expression = PolymerExpressions.getExpression(expressionText);
                    var observable = expression.getBinding(this, this.element.syntax);
                    this.bindToAccessor(name, observable)
                } catch (ex) {
                    console.error("Failed to create computed property", ex)
                }
            }
        },
        registerObserver: function(observer) {
            if (!this._observers) {
                this._observers = [observer];
                return
            }
            this._observers.push(observer)
        },
        closeObservers: function() {
            if (!this._observers) {
                return
            }
            var observers = this._observers;
            for (var i = 0; i < observers.length; i++) {
                var observer = observers[i];
                if (observer && typeof observer.close == "function") {
                    observer.close()
                }
            }
            this._observers = []
        },
        registerNamedObserver: function(name, observer) {
            var o$ = this._namedObservers || (this._namedObservers = {});
            o$[name] = observer
        },
        closeNamedObserver: function(name) {
            var o$ = this._namedObservers;
            if (o$ && o$[name]) {
                o$[name].close();
                o$[name] = null ;
                return true
            }
        },
        closeNamedObservers: function() {
            if (this._namedObservers) {
                for (var i in this._namedObservers) {
                    this.closeNamedObserver(i)
                }
                this._namedObservers = {}
            }
        }
    };
    var LOG_OBSERVE = "[%s] watching [%s]";
    var LOG_OBSERVED = "[%s#%s] watch: [%s] now [%s] was [%s]";
    var LOG_CHANGED = "[%s#%s] propertyChanged: [%s] now [%s] was [%s]";
    scope.api.instance.properties = properties
}
)(Polymer);
(function(scope) {
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var mdv = {
        instanceTemplate: function(template) {
            HTMLTemplateElement.decorate(template);
            var syntax = this.syntax || !template.bindingDelegate && this.element.syntax;
            var dom = template.createInstance(this, syntax);
            var observers = dom.bindings_;
            for (var i = 0; i < observers.length; i++) {
                this.registerObserver(observers[i])
            }
            return dom
        },
        bind: function(name, observable, oneTime) {
            var property = this.propertyForAttribute(name);
            if (!property) {
                return this.mixinSuper(arguments)
            } else {
                var observer = this.bindProperty(property, observable, oneTime);
                if (Platform.enableBindingsReflection && observer) {
                    observer.path = observable.path_;
                    this._recordBinding(property, observer)
                }
                if (this.reflect[property]) {
                    this.reflectPropertyToAttribute(property)
                }
                return observer
            }
        },
        _recordBinding: function(name, observer) {
            this.bindings_ = this.bindings_ || {};
            this.bindings_[name] = observer
        },
        bindFinished: function() {
            this.makeElementReady()
        },
        asyncUnbindAll: function() {
            if (!this._unbound) {
                log.unbind && console.log("[%s] asyncUnbindAll", this.localName);
                this._unbindAllJob = this.job(this._unbindAllJob, this.unbindAll, 0)
            }
        },
        unbindAll: function() {
            if (!this._unbound) {
                this.closeObservers();
                this.closeNamedObservers();
                this._unbound = true
            }
        },
        cancelUnbindAll: function() {
            if (this._unbound) {
                log.unbind && console.warn("[%s] already unbound, cannot cancel unbindAll", this.localName);
                return
            }
            log.unbind && console.log("[%s] cancelUnbindAll", this.localName);
            if (this._unbindAllJob) {
                this._unbindAllJob = this._unbindAllJob.stop()
            }
        }
    };
    function unbindNodeTree(node) {
        forNodeTree(node, _nodeUnbindAll)
    }
    function _nodeUnbindAll(node) {
        node.unbindAll()
    }
    function forNodeTree(node, callback) {
        if (node) {
            callback(node);
            for (var child = node.firstChild; child; child = child.nextSibling) {
                forNodeTree(child, callback)
            }
        }
    }
    var mustachePattern = /\{\{([^{}]*)}}/;
    scope.bindPattern = mustachePattern;
    scope.api.instance.mdv = mdv
}
)(Polymer);
(function(scope) {
    var base = {
        PolymerBase: true,
        job: function(job, callback, wait) {
            if (typeof job === "string") {
                var n = "___" + job;
                this[n] = Polymer.job.call(this, this[n], callback, wait)
            } else {
                return Polymer.job.call(this, job, callback, wait)
            }
        },
        "super": Polymer.super,
        created: function() {},
        ready: function() {},
        createdCallback: function() {
            if (this.templateInstance && this.templateInstance.model) {
                console.warn("Attributes on " + this.localName + " were data bound " + "prior to Polymer upgrading the element. This may result in " + "incorrect binding types.")
            }
            this.created();
            this.prepareElement();
            if (!this.ownerDocument.isStagingDocument) {
                this.makeElementReady()
            }
        },
        prepareElement: function() {
            if (this._elementPrepared) {
                console.warn("Element already prepared", this.localName);
                return
            }
            this._elementPrepared = true;
            this.shadowRoots = {};
            this.createPropertyObserver();
            this.openPropertyObserver();
            this.copyInstanceAttributes();
            this.takeAttributes();
            this.addHostListeners()
        },
        makeElementReady: function() {
            if (this._readied) {
                return
            }
            this._readied = true;
            this.createComputedProperties();
            this.parseDeclarations(this.__proto__);
            this.removeAttribute("unresolved");
            this.ready()
        },
        attributeChangedCallback: function(name, oldValue) {
            if (name !== "class" && name !== "style") {
                this.attributeToProperty(name, this.getAttribute(name))
            }
            if (this.attributeChanged) {
                this.attributeChanged.apply(this, arguments)
            }
        },
        attachedCallback: function() {
            this.cancelUnbindAll();
            if (this.attached) {
                this.attached()
            }
            if (!this.hasBeenAttached) {
                this.hasBeenAttached = true;
                if (this.domReady) {
                    this.async("domReady")
                }
            }
        },
        detachedCallback: function() {
            if (!this.preventDispose) {
                this.asyncUnbindAll()
            }
            if (this.detached) {
                this.detached()
            }
            if (this.leftView) {
                this.leftView()
            }
        },
        parseDeclarations: function(p) {
            if (p && p.element) {
                this.parseDeclarations(p.__proto__);
                p.parseDeclaration.call(this, p.element)
            }
        },
        parseDeclaration: function(elementElement) {
            var template = this.fetchTemplate(elementElement);
            if (template) {
                var root = this.shadowFromTemplate(template);
                this.shadowRoots[elementElement.name] = root
            }
        },
        fetchTemplate: function(elementElement) {
            return elementElement.querySelector("template")
        },
        shadowFromTemplate: function(template) {
            if (template) {
                var root = this.createShadowRoot();
                var dom = this.instanceTemplate(template);
                root.appendChild(dom);
                this.shadowRootReady(root, template);
                return root
            }
        },
        lightFromTemplate: function(template, refNode) {
            if (template) {
                this.eventController = this;
                var dom = this.instanceTemplate(template);
                if (refNode) {
                    this.insertBefore(dom, refNode)
                } else {
                    this.appendChild(dom)
                }
                this.shadowRootReady(this);
                return dom
            }
        },
        shadowRootReady: function(root) {
            this.marshalNodeReferences(root)
        },
        marshalNodeReferences: function(root) {
            var $ = this.$ = this.$ || {};
            if (root) {
                var n$ = root.querySelectorAll("[id]");
                for (var i = 0, l = n$.length, n; i < l && (n = n$[i]); i++) {
                    $[n.id] = n
                }
            }
        },
        onMutation: function(node, listener) {
            var observer = new MutationObserver(function(mutations) {
                listener.call(this, observer, mutations);
                observer.disconnect()
            }
            .bind(this));
            observer.observe(node, {
                childList: true,
                subtree: true
            })
        }
    };
    function isBase(object) {
        return object.hasOwnProperty("PolymerBase")
    }
    function PolymerBase() {}
    PolymerBase.prototype = base;
    base.constructor = PolymerBase;
    scope.Base = PolymerBase;
    scope.isBase = isBase;
    scope.api.instance.base = base
}
)(Polymer);
(function(scope) {
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var hasShadowDOMPolyfill = window.ShadowDOMPolyfill;
    var STYLE_SCOPE_ATTRIBUTE = "element";
    var STYLE_CONTROLLER_SCOPE = "controller";
    var styles = {
        STYLE_SCOPE_ATTRIBUTE: STYLE_SCOPE_ATTRIBUTE,
        installControllerStyles: function() {
            var scope = this.findStyleScope();
            if (scope && !this.scopeHasNamedStyle(scope, this.localName)) {
                var proto = getPrototypeOf(this)
                  , cssText = "";
                while (proto && proto.element) {
                    cssText += proto.element.cssTextForScope(STYLE_CONTROLLER_SCOPE);
                    proto = getPrototypeOf(proto)
                }
                if (cssText) {
                    this.installScopeCssText(cssText, scope)
                }
            }
        },
        installScopeStyle: function(style, name, scope) {
            scope = scope || this.findStyleScope();
            name = name || "";
            if (scope && !this.scopeHasNamedStyle(scope, this.localName + name)) {
                var cssText = "";
                if (style instanceof Array) {
                    for (var i = 0, l = style.length, s; i < l && (s = style[i]); i++) {
                        cssText += s.textContent + "\n\n"
                    }
                } else {
                    cssText = style.textContent
                }
                this.installScopeCssText(cssText, scope, name)
            }
        },
        installScopeCssText: function(cssText, scope, name) {
            scope = scope || this.findStyleScope();
            name = name || "";
            if (!scope) {
                return
            }
            if (hasShadowDOMPolyfill) {
                cssText = shimCssText(cssText, scope.host)
            }
            var style = this.element.cssTextToScopeStyle(cssText, STYLE_CONTROLLER_SCOPE);
            Polymer.applyStyleToScope(style, scope);
            this.styleCacheForScope(scope)[this.localName + name] = true
        },
        findStyleScope: function(node) {
            var n = node || this;
            while (n.parentNode) {
                n = n.parentNode
            }
            return n
        },
        scopeHasNamedStyle: function(scope, name) {
            var cache = this.styleCacheForScope(scope);
            return cache[name]
        },
        styleCacheForScope: function(scope) {
            if (hasShadowDOMPolyfill) {
                var scopeName = scope.host ? scope.host.localName : scope.localName;
                return polyfillScopeStyleCache[scopeName] || (polyfillScopeStyleCache[scopeName] = {})
            } else {
                return scope._scopeStyles = scope._scopeStyles || {}
            }
        }
    };
    var polyfillScopeStyleCache = {};
    function getPrototypeOf(prototype) {
        return prototype.__proto__
    }
    function shimCssText(cssText, host) {
        var name = ""
          , is = false;
        if (host) {
            name = host.localName;
            is = host.hasAttribute("is")
        }
        var selector = WebComponents.ShadowCSS.makeScopeSelector(name, is);
        return WebComponents.ShadowCSS.shimCssText(cssText, selector)
    }
    scope.api.instance.styles = styles
}
)(Polymer);
(function(scope) {
    var extend = scope.extend;
    var api = scope.api;
    function element(name, prototype) {
        if (typeof name !== "string") {
            var script = prototype || document._currentScript;
            prototype = name;
            name = script && script.parentNode && script.parentNode.getAttribute ? script.parentNode.getAttribute("name") : "";
            if (!name) {
                throw "Element name could not be inferred."
            }
        }
        if (getRegisteredPrototype(name)) {
            throw "Already registered (Polymer) prototype for element " + name
        }
        registerPrototype(name, prototype);
        notifyPrototype(name)
    }
    function waitingForPrototype(name, client) {
        waitPrototype[name] = client
    }
    var waitPrototype = {};
    function notifyPrototype(name) {
        if (waitPrototype[name]) {
            waitPrototype[name].registerWhenReady();
            delete waitPrototype[name]
        }
    }
    var prototypesByName = {};
    function registerPrototype(name, prototype) {
        return prototypesByName[name] = prototype || {}
    }
    function getRegisteredPrototype(name) {
        return prototypesByName[name]
    }
    function instanceOfType(element, type) {
        if (typeof type !== "string") {
            return false
        }
        var proto = HTMLElement.getPrototypeForTag(type);
        var ctor = proto && proto.constructor;
        if (!ctor) {
            return false
        }
        if (CustomElements.instanceof) {
            return CustomElements.instanceof(element, ctor)
        }
        return element instanceof ctor
    }
    scope.getRegisteredPrototype = getRegisteredPrototype;
    scope.waitingForPrototype = waitingForPrototype;
    scope.instanceOfType = instanceOfType;
    window.Polymer = element;
    extend(Polymer, scope);
    if (WebComponents.consumeDeclarations) {
        WebComponents.consumeDeclarations(function(declarations) {
            if (declarations) {
                for (var i = 0, l = declarations.length, d; i < l && (d = declarations[i]); i++) {
                    element.apply(null , d)
                }
            }
        }
        )
    }
}
)(Polymer);
(function(scope) {
    var path = {
        resolveElementPaths: function(node) {
            Polymer.urlResolver.resolveDom(node)
        },
        addResolvePathApi: function() {
            var assetPath = this.getAttribute("assetpath") || "";
            var root = new URL(assetPath,this.ownerDocument.baseURI);
            this.prototype.resolvePath = function(urlPath, base) {
                var u = new URL(urlPath,base || root);
                return u.href
            }
        }
    };
    scope.api.declaration.path = path
}
)(Polymer);
(function(scope) {
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var api = scope.api.instance.styles;
    var STYLE_SCOPE_ATTRIBUTE = api.STYLE_SCOPE_ATTRIBUTE;
    var hasShadowDOMPolyfill = window.ShadowDOMPolyfill;
    var STYLE_SELECTOR = "style";
    var STYLE_LOADABLE_MATCH = "@import";
    var SHEET_SELECTOR = "link[rel=stylesheet]";
    var STYLE_GLOBAL_SCOPE = "global";
    var SCOPE_ATTR = "polymer-scope";
    var styles = {
        loadStyles: function(callback) {
            var template = this.fetchTemplate();
            var content = template && this.templateContent();
            if (content) {
                this.convertSheetsToStyles(content);
                var styles = this.findLoadableStyles(content);
                if (styles.length) {
                    var templateUrl = template.ownerDocument.baseURI;
                    return Polymer.styleResolver.loadStyles(styles, templateUrl, callback)
                }
            }
            if (callback) {
                callback()
            }
        },
        convertSheetsToStyles: function(root) {
            var s$ = root.querySelectorAll(SHEET_SELECTOR);
            for (var i = 0, l = s$.length, s, c; i < l && (s = s$[i]); i++) {
                c = createStyleElement(importRuleForSheet(s, this.ownerDocument.baseURI), this.ownerDocument);
                this.copySheetAttributes(c, s);
                s.parentNode.replaceChild(c, s)
            }
        },
        copySheetAttributes: function(style, link) {
            for (var i = 0, a$ = link.attributes, l = a$.length, a; (a = a$[i]) && i < l; i++) {
                if (a.name !== "rel" && a.name !== "href") {
                    style.setAttribute(a.name, a.value)
                }
            }
        },
        findLoadableStyles: function(root) {
            var loadables = [];
            if (root) {
                var s$ = root.querySelectorAll(STYLE_SELECTOR);
                for (var i = 0, l = s$.length, s; i < l && (s = s$[i]); i++) {
                    if (s.textContent.match(STYLE_LOADABLE_MATCH)) {
                        loadables.push(s)
                    }
                }
            }
            return loadables
        },
        installSheets: function() {
            this.cacheSheets();
            this.cacheStyles();
            this.installLocalSheets();
            this.installGlobalStyles()
        },
        cacheSheets: function() {
            this.sheets = this.findNodes(SHEET_SELECTOR);
            this.sheets.forEach(function(s) {
                if (s.parentNode) {
                    s.parentNode.removeChild(s)
                }
            }
            )
        },
        cacheStyles: function() {
            this.styles = this.findNodes(STYLE_SELECTOR + "[" + SCOPE_ATTR + "]");
            this.styles.forEach(function(s) {
                if (s.parentNode) {
                    s.parentNode.removeChild(s)
                }
            }
            )
        },
        installLocalSheets: function() {
            var sheets = this.sheets.filter(function(s) {
                return !s.hasAttribute(SCOPE_ATTR)
            }
            );
            var content = this.templateContent();
            if (content) {
                var cssText = "";
                sheets.forEach(function(sheet) {
                    cssText += cssTextFromSheet(sheet) + "\n"
                }
                );
                if (cssText) {
                    var style = createStyleElement(cssText, this.ownerDocument);
                    content.insertBefore(style, content.firstChild)
                }
            }
        },
        findNodes: function(selector, matcher) {
            var nodes = this.querySelectorAll(selector).array();
            var content = this.templateContent();
            if (content) {
                var templateNodes = content.querySelectorAll(selector).array();
                nodes = nodes.concat(templateNodes)
            }
            return matcher ? nodes.filter(matcher) : nodes
        },
        installGlobalStyles: function() {
            var style = this.styleForScope(STYLE_GLOBAL_SCOPE);
            applyStyleToScope(style, document.head)
        },
        cssTextForScope: function(scopeDescriptor) {
            var cssText = "";
            var selector = "[" + SCOPE_ATTR + "=" + scopeDescriptor + "]";
            var matcher = function(s) {
                return matchesSelector(s, selector)
            }
            ;
            var sheets = this.sheets.filter(matcher);
            sheets.forEach(function(sheet) {
                cssText += cssTextFromSheet(sheet) + "\n\n"
            }
            );
            var styles = this.styles.filter(matcher);
            styles.forEach(function(style) {
                cssText += style.textContent + "\n\n"
            }
            );
            return cssText
        },
        styleForScope: function(scopeDescriptor) {
            var cssText = this.cssTextForScope(scopeDescriptor);
            return this.cssTextToScopeStyle(cssText, scopeDescriptor)
        },
        cssTextToScopeStyle: function(cssText, scopeDescriptor) {
            if (cssText) {
                var style = createStyleElement(cssText);
                style.setAttribute(STYLE_SCOPE_ATTRIBUTE, this.getAttribute("name") + "-" + scopeDescriptor);
                return style
            }
        }
    };
    function importRuleForSheet(sheet, baseUrl) {
        var href = new URL(sheet.getAttribute("href"),baseUrl).href;
        return "@import '" + href + "';"
    }
    function applyStyleToScope(style, scope) {
        if (style) {
            if (scope === document) {
                scope = document.head
            }
            if (hasShadowDOMPolyfill) {
                scope = document.head
            }
            var clone = createStyleElement(style.textContent);
            var attr = style.getAttribute(STYLE_SCOPE_ATTRIBUTE);
            if (attr) {
                clone.setAttribute(STYLE_SCOPE_ATTRIBUTE, attr)
            }
            var refNode = scope.firstElementChild;
            if (scope === document.head) {
                var selector = "style[" + STYLE_SCOPE_ATTRIBUTE + "]";
                var s$ = document.head.querySelectorAll(selector);
                if (s$.length) {
                    refNode = s$[s$.length - 1].nextElementSibling
                }
            }
            scope.insertBefore(clone, refNode)
        }
    }
    function createStyleElement(cssText, scope) {
        scope = scope || document;
        scope = scope.createElement ? scope : scope.ownerDocument;
        var style = scope.createElement("style");
        style.textContent = cssText;
        return style
    }
    function cssTextFromSheet(sheet) {
        return sheet && sheet.__resource || ""
    }
    function matchesSelector(node, inSelector) {
        if (matches) {
            return matches.call(node, inSelector)
        }
    }
    var p = HTMLElement.prototype;
    var matches = p.matches || p.matchesSelector || p.webkitMatchesSelector || p.mozMatchesSelector;
    scope.api.declaration.styles = styles;
    scope.applyStyleToScope = applyStyleToScope
}
)(Polymer);
(function(scope) {
    var log = window.WebComponents ? WebComponents.flags.log : {};
    var api = scope.api.instance.events;
    var EVENT_PREFIX = api.EVENT_PREFIX;
    var mixedCaseEventTypes = {};
    ["webkitAnimationStart", "webkitAnimationEnd", "webkitTransitionEnd", "DOMFocusOut", "DOMFocusIn", "DOMMouseScroll"].forEach(function(e) {
        mixedCaseEventTypes[e.toLowerCase()] = e
    }
    );
    var events = {
        parseHostEvents: function() {
            var delegates = this.prototype.eventDelegates;
            this.addAttributeDelegates(delegates)
        },
        addAttributeDelegates: function(delegates) {
            for (var i = 0, a; a = this.attributes[i]; i++) {
                if (this.hasEventPrefix(a.name)) {
                    delegates[this.removeEventPrefix(a.name)] = a.value.replace("{{", "").replace("}}", "").trim()
                }
            }
        },
        hasEventPrefix: function(n) {
            return n && n[0] === "o" && n[1] === "n" && n[2] === "-"
        },
        removeEventPrefix: function(n) {
            return n.slice(prefixLength)
        },
        findController: function(node) {
            while (node.parentNode) {
                if (node.eventController) {
                    return node.eventController
                }
                node = node.parentNode
            }
            return node.host
        },
        getEventHandler: function(controller, target, method) {
            var events = this;
            return function(e) {
                if (!controller || !controller.PolymerBase) {
                    controller = events.findController(target)
                }
                var args = [e, e.detail, e.currentTarget];
                controller.dispatchMethod(controller, method, args)
            }
        },
        prepareEventBinding: function(pathString, name, node) {
            if (!this.hasEventPrefix(name))
                return;
            var eventType = this.removeEventPrefix(name);
            eventType = mixedCaseEventTypes[eventType] || eventType;
            var events = this;
            return function(model, node, oneTime) {
                var handler = events.getEventHandler(undefined, node, pathString);
                PolymerGestures.addEventListener(node, eventType, handler);
                if (oneTime)
                    return;
                function bindingValue() {
                    return "{{ " + pathString + " }}"
                }
                return {
                    open: bindingValue,
                    discardChanges: bindingValue,
                    close: function() {
                        PolymerGestures.removeEventListener(node, eventType, handler)
                    }
                }
            }
        }
    };
    var prefixLength = EVENT_PREFIX.length;
    scope.api.declaration.events = events
}
)(Polymer);
(function(scope) {
    var observationBlacklist = ["attribute"];
    var properties = {
        inferObservers: function(prototype) {
            var observe = prototype.observe, property;
            for (var n in prototype) {
                if (n.slice(-7) === "Changed") {
                    property = n.slice(0, -7);
                    if (this.canObserveProperty(property)) {
                        if (!observe) {
                            observe = prototype.observe = {}
                        }
                        observe[property] = observe[property] || n
                    }
                }
            }
        },
        canObserveProperty: function(property) {
            return observationBlacklist.indexOf(property) < 0
        },
        explodeObservers: function(prototype) {
            var o = prototype.observe;
            if (o) {
                var exploded = {};
                for (var n in o) {
                    var names = n.split(" ");
                    for (var i = 0, ni; ni = names[i]; i++) {
                        exploded[ni] = o[n]
                    }
                }
                prototype.observe = exploded
            }
        },
        optimizePropertyMaps: function(prototype) {
            if (prototype.observe) {
                var a = prototype._observeNames = [];
                for (var n in prototype.observe) {
                    var names = n.split(" ");
                    for (var i = 0, ni; ni = names[i]; i++) {
                        a.push(ni)
                    }
                }
            }
            if (prototype.publish) {
                var a = prototype._publishNames = [];
                for (var n in prototype.publish) {
                    a.push(n)
                }
            }
            if (prototype.computed) {
                var a = prototype._computedNames = [];
                for (var n in prototype.computed) {
                    a.push(n)
                }
            }
        },
        publishProperties: function(prototype, base) {
            var publish = prototype.publish;
            if (publish) {
                this.requireProperties(publish, prototype, base);
                this.filterInvalidAccessorNames(publish);
                prototype._publishLC = this.lowerCaseMap(publish)
            }
            var computed = prototype.computed;
            if (computed) {
                this.filterInvalidAccessorNames(computed)
            }
        },
        filterInvalidAccessorNames: function(propertyNames) {
            for (var name in propertyNames) {
                if (this.propertyNameBlacklist[name]) {
                    console.warn('Cannot define property "' + name + '" for element "' + this.name + '" because it has the same name as an HTMLElement ' + "property, and not all browsers support overriding that. " + "Consider giving it a different name.");
                    delete propertyNames[name]
                }
            }
        },
        requireProperties: function(propertyInfos, prototype, base) {
            prototype.reflect = prototype.reflect || {};
            for (var n in propertyInfos) {
                var value = propertyInfos[n];
                if (value && value.reflect !== undefined) {
                    prototype.reflect[n] = Boolean(value.reflect);
                    value = value.value
                }
                if (value !== undefined) {
                    prototype[n] = value
                }
            }
        },
        lowerCaseMap: function(properties) {
            var map = {};
            for (var n in properties) {
                map[n.toLowerCase()] = n
            }
            return map
        },
        createPropertyAccessor: function(name, ignoreWrites) {
            var proto = this.prototype;
            var privateName = name + "_";
            var privateObservable = name + "Observable_";
            proto[privateName] = proto[name];
            Object.defineProperty(proto, name, {
                get: function() {
                    var observable = this[privateObservable];
                    if (observable)
                        observable.deliver();
                    return this[privateName]
                },
                set: function(value) {
                    if (ignoreWrites) {
                        return this[privateName]
                    }
                    var observable = this[privateObservable];
                    if (observable) {
                        observable.setValue(value);
                        return
                    }
                    var oldValue = this[privateName];
                    this[privateName] = value;
                    this.emitPropertyChangeRecord(name, value, oldValue);
                    return value
                },
                configurable: true
            })
        },
        createPropertyAccessors: function(prototype) {
            var n$ = prototype._computedNames;
            if (n$ && n$.length) {
                for (var i = 0, l = n$.length, n, fn; i < l && (n = n$[i]); i++) {
                    this.createPropertyAccessor(n, true)
                }
            }
            n$ = prototype._publishNames;
            if (n$ && n$.length) {
                for (var i = 0, l = n$.length, n, fn; i < l && (n = n$[i]); i++) {
                    if (!prototype.computed || !prototype.computed[n]) {
                        this.createPropertyAccessor(n)
                    }
                }
            }
        },
        propertyNameBlacklist: {
            children: 1,
            "class": 1,
            id: 1,
            hidden: 1,
            style: 1,
            title: 1
        }
    };
    scope.api.declaration.properties = properties
}
)(Polymer);
(function(scope) {
    var ATTRIBUTES_ATTRIBUTE = "attributes";
    var ATTRIBUTES_REGEX = /\s|,/;
    var attributes = {
        inheritAttributesObjects: function(prototype) {
            this.inheritObject(prototype, "publishLC");
            this.inheritObject(prototype, "_instanceAttributes")
        },
        publishAttributes: function(prototype, base) {
            var attributes = this.getAttribute(ATTRIBUTES_ATTRIBUTE);
            if (attributes) {
                var publish = prototype.publish || (prototype.publish = {});
                var names = attributes.split(ATTRIBUTES_REGEX);
                for (var i = 0, l = names.length, n; i < l; i++) {
                    n = names[i].trim();
                    if (n && publish[n] === undefined) {
                        publish[n] = undefined
                    }
                }
            }
        },
        accumulateInstanceAttributes: function() {
            var clonable = this.prototype._instanceAttributes;
            var a$ = this.attributes;
            for (var i = 0, l = a$.length, a; i < l && (a = a$[i]); i++) {
                if (this.isInstanceAttribute(a.name)) {
                    clonable[a.name] = a.value
                }
            }
        },
        isInstanceAttribute: function(name) {
            return !this.blackList[name] && name.slice(0, 3) !== "on-"
        },
        blackList: {
            name: 1,
            "extends": 1,
            constructor: 1,
            noscript: 1,
            assetpath: 1,
            "cache-csstext": 1
        }
    };
    attributes.blackList[ATTRIBUTES_ATTRIBUTE] = 1;
    scope.api.declaration.attributes = attributes
}
)(Polymer);
(function(scope) {
    var events = scope.api.declaration.events;
    var syntax = new PolymerExpressions;
    var prepareBinding = syntax.prepareBinding;
    syntax.prepareBinding = function(pathString, name, node) {
        return events.prepareEventBinding(pathString, name, node) || prepareBinding.call(syntax, pathString, name, node)
    }
    ;
    var mdv = {
        syntax: syntax,
        fetchTemplate: function() {
            return this.querySelector("template")
        },
        templateContent: function() {
            var template = this.fetchTemplate();
            return template && template.content
        },
        installBindingDelegate: function(template) {
            if (template) {
                template.bindingDelegate = this.syntax
            }
        }
    };
    scope.api.declaration.mdv = mdv
}
)(Polymer);
(function(scope) {
    var api = scope.api;
    var isBase = scope.isBase;
    var extend = scope.extend;
    var hasShadowDOMPolyfill = window.ShadowDOMPolyfill;
    var prototype = {
        register: function(name, extendeeName) {
            this.buildPrototype(name, extendeeName);
            this.registerPrototype(name, extendeeName);
            this.publishConstructor()
        },
        buildPrototype: function(name, extendeeName) {
            var extension = scope.getRegisteredPrototype(name);
            var base = this.generateBasePrototype(extendeeName);
            this.desugarBeforeChaining(extension, base);
            this.prototype = this.chainPrototypes(extension, base);
            this.desugarAfterChaining(name, extendeeName)
        },
        desugarBeforeChaining: function(prototype, base) {
            prototype.element = this;
            this.publishAttributes(prototype, base);
            this.publishProperties(prototype, base);
            this.inferObservers(prototype);
            this.explodeObservers(prototype)
        },
        chainPrototypes: function(prototype, base) {
            this.inheritMetaData(prototype, base);
            var chained = this.chainObject(prototype, base);
            ensurePrototypeTraversal(chained);
            return chained
        },
        inheritMetaData: function(prototype, base) {
            this.inheritObject("observe", prototype, base);
            this.inheritObject("publish", prototype, base);
            this.inheritObject("reflect", prototype, base);
            this.inheritObject("_publishLC", prototype, base);
            this.inheritObject("_instanceAttributes", prototype, base);
            this.inheritObject("eventDelegates", prototype, base)
        },
        desugarAfterChaining: function(name, extendee) {
            this.optimizePropertyMaps(this.prototype);
            this.createPropertyAccessors(this.prototype);
            this.installBindingDelegate(this.fetchTemplate());
            this.installSheets();
            this.resolveElementPaths(this);
            this.accumulateInstanceAttributes();
            this.parseHostEvents();
            this.addResolvePathApi();
            if (hasShadowDOMPolyfill) {
                WebComponents.ShadowCSS.shimStyling(this.templateContent(), name, extendee)
            }
            if (this.prototype.registerCallback) {
                this.prototype.registerCallback(this)
            }
        },
        publishConstructor: function() {
            var symbol = this.getAttribute("constructor");
            if (symbol) {
                window[symbol] = this.ctor
            }
        },
        generateBasePrototype: function(extnds) {
            var prototype = this.findBasePrototype(extnds);
            if (!prototype) {
                prototype = HTMLElement.getPrototypeForTag(extnds);
                prototype = this.ensureBaseApi(prototype);
                memoizedBases[extnds] = prototype
            }
            return prototype
        },
        findBasePrototype: function(name) {
            return memoizedBases[name]
        },
        ensureBaseApi: function(prototype) {
            if (prototype.PolymerBase) {
                return prototype
            }
            var extended = Object.create(prototype);
            api.publish(api.instance, extended);
            this.mixinMethod(extended, prototype, api.instance.mdv, "bind");
            return extended
        },
        mixinMethod: function(extended, prototype, api, name) {
            var $super = function(args) {
                return prototype[name].apply(this, args)
            }
            ;
            extended[name] = function() {
                this.mixinSuper = $super;
                return api[name].apply(this, arguments)
            }
        },
        inheritObject: function(name, prototype, base) {
            var source = prototype[name] || {};
            prototype[name] = this.chainObject(source, base[name])
        },
        registerPrototype: function(name, extendee) {
            var info = {
                prototype: this.prototype
            };
            var typeExtension = this.findTypeExtension(extendee);
            if (typeExtension) {
                info.extends = typeExtension
            }
            HTMLElement.register(name, this.prototype);
            this.ctor = document.registerElement(name, info)
        },
        findTypeExtension: function(name) {
            if (name && name.indexOf("-") < 0) {
                return name
            } else {
                var p = this.findBasePrototype(name);
                if (p.element) {
                    return this.findTypeExtension(p.element.extends)
                }
            }
        }
    };
    var memoizedBases = {};
    if (Object.__proto__) {
        prototype.chainObject = function(object, inherited) {
            if (object && inherited && object !== inherited) {
                object.__proto__ = inherited
            }
            return object
        }
    } else {
        prototype.chainObject = function(object, inherited) {
            if (object && inherited && object !== inherited) {
                var chained = Object.create(inherited);
                object = extend(chained, object)
            }
            return object
        }
    }
    function ensurePrototypeTraversal(prototype) {
        if (!Object.__proto__) {
            var ancestor = Object.getPrototypeOf(prototype);
            prototype.__proto__ = ancestor;
            if (isBase(ancestor)) {
                ancestor.__proto__ = Object.getPrototypeOf(ancestor)
            }
        }
    }
    api.declaration.prototype = prototype
}
)(Polymer);
(function(scope) {
    var queue = {
        wait: function(element) {
            if (!element.__queue) {
                element.__queue = {};
                elements.push(element)
            }
        },
        enqueue: function(element, check, go) {
            var shouldAdd = element.__queue && !element.__queue.check;
            if (shouldAdd) {
                queueForElement(element).push(element);
                element.__queue.check = check;
                element.__queue.go = go
            }
            return this.indexOf(element) !== 0
        },
        indexOf: function(element) {
            var i = queueForElement(element).indexOf(element);
            if (i >= 0 && document.contains(element)) {
                i += HTMLImports.useNative || HTMLImports.ready ? importQueue.length : 1e9
            }
            return i
        },
        go: function(element) {
            var readied = this.remove(element);
            if (readied) {
                element.__queue.flushable = true;
                this.addToFlushQueue(readied);
                this.check()
            }
        },
        remove: function(element) {
            var i = this.indexOf(element);
            if (i !== 0) {
                return
            }
            return queueForElement(element).shift()
        },
        check: function() {
            var element = this.nextElement();
            if (element) {
                element.__queue.check.call(element)
            }
            if (this.canReady()) {
                this.ready();
                return true
            }
        },
        nextElement: function() {
            return nextQueued()
        },
        canReady: function() {
            return !this.waitToReady && this.isEmpty()
        },
        isEmpty: function() {
            for (var i = 0, l = elements.length, e; i < l && (e = elements[i]); i++) {
                if (e.__queue && !e.__queue.flushable) {
                    return
                }
            }
            return true
        },
        addToFlushQueue: function(element) {
            flushQueue.push(element)
        },
        flush: function() {
            if (this.flushing) {
                return
            }
            this.flushing = true;
            var element;
            while (flushQueue.length) {
                element = flushQueue.shift();
                element.__queue.go.call(element);
                element.__queue = null 
            }
            this.flushing = false
        },
        ready: function() {
            var polyfillWasReady = CustomElements.ready;
            CustomElements.ready = false;
            this.flush();
            if (!CustomElements.useNative) {
                CustomElements.upgradeDocumentTree(document)
            }
            CustomElements.ready = polyfillWasReady;
            Polymer.flush();
            requestAnimationFrame(this.flushReadyCallbacks)
        },
        addReadyCallback: function(callback) {
            if (callback) {
                readyCallbacks.push(callback)
            }
        },
        flushReadyCallbacks: function() {
            if (readyCallbacks) {
                var fn;
                while (readyCallbacks.length) {
                    fn = readyCallbacks.shift();
                    fn()
                }
            }
        },
        waitingFor: function() {
            var e$ = [];
            for (var i = 0, l = elements.length, e; i < l && (e = elements[i]); i++) {
                if (e.__queue && !e.__queue.flushable) {
                    e$.push(e)
                }
            }
            return e$
        },
        waitToReady: true
    };
    var elements = [];
    var flushQueue = [];
    var importQueue = [];
    var mainQueue = [];
    var readyCallbacks = [];
    function queueForElement(element) {
        return document.contains(element) ? mainQueue : importQueue
    }
    function nextQueued() {
        return importQueue.length ? importQueue[0] : mainQueue[0]
    }
    function whenReady(callback) {
        queue.waitToReady = true;
        Polymer.endOfMicrotask(function() {
            HTMLImports.whenReady(function() {
                queue.addReadyCallback(callback);
                queue.waitToReady = false;
                queue.check()
            }
            )
        }
        )
    }
    function forceReady(timeout) {
        if (timeout === undefined) {
            queue.ready();
            return
        }
        var handle = setTimeout(function() {
            queue.ready()
        }
        , timeout);
        Polymer.whenReady(function() {
            clearTimeout(handle)
        }
        )
    }
    scope.elements = elements;
    scope.waitingFor = queue.waitingFor.bind(queue);
    scope.forceReady = forceReady;
    scope.queue = queue;
    scope.whenReady = scope.whenPolymerReady = whenReady
}
)(Polymer);
(function(scope) {
    var extend = scope.extend;
    var api = scope.api;
    var queue = scope.queue;
    var whenReady = scope.whenReady;
    var getRegisteredPrototype = scope.getRegisteredPrototype;
    var waitingForPrototype = scope.waitingForPrototype;
    var prototype = extend(Object.create(HTMLElement.prototype), {
        createdCallback: function() {
            if (this.getAttribute("name")) {
                this.init()
            }
        },
        init: function() {
            this.name = this.getAttribute("name");
            this.extends = this.getAttribute("extends");
            queue.wait(this);
            this.loadResources();
            this.registerWhenReady()
        },
        registerWhenReady: function() {
            if (this.registered || this.waitingForPrototype(this.name) || this.waitingForQueue() || this.waitingForResources()) {
                return
            }
            queue.go(this)
        },
        _register: function() {
            if (isCustomTag(this.extends) && !isRegistered(this.extends)) {
                console.warn("%s is attempting to extend %s, an unregistered element " + "or one that was not registered with Polymer.", this.name, this.extends)
            }
            this.register(this.name, this.extends);
            this.registered = true
        },
        waitingForPrototype: function(name) {
            if (!getRegisteredPrototype(name)) {
                waitingForPrototype(name, this);
                this.handleNoScript(name);
                return true
            }
        },
        handleNoScript: function(name) {
            if (this.hasAttribute("noscript") && !this.noscript) {
                this.noscript = true;
                Polymer(name)
            }
        },
        waitingForResources: function() {
            return this._needsResources
        },
        waitingForQueue: function() {
            return queue.enqueue(this, this.registerWhenReady, this._register)
        },
        loadResources: function() {
            this._needsResources = true;
            this.loadStyles(function() {
                this._needsResources = false;
                this.registerWhenReady()
            }
            .bind(this))
        }
    });
    api.publish(api.declaration, prototype);
    function isRegistered(name) {
        return Boolean(HTMLElement.getPrototypeForTag(name))
    }
    function isCustomTag(name) {
        return name && name.indexOf("-") >= 0
    }
    whenReady(function() {
        document.body.removeAttribute("unresolved");
        document.dispatchEvent(new CustomEvent("polymer-ready",{
            bubbles: true
        }))
    }
    );
    document.registerElement("polymer-element", {
        prototype: prototype
    })
}
)(Polymer);
(function(scope) {
    var whenReady = scope.whenReady;
    function importElements(node, callback) {
        if (node) {
            document.head.appendChild(node);
            whenReady(callback)
        } else if (callback) {
            callback()
        }
    }
    function _import(urls, callback) {
        if (urls && urls.length) {
            var frag = document.createDocumentFragment();
            for (var i = 0, l = urls.length, url, link; i < l && (url = urls[i]); i++) {
                link = document.createElement("link");
                link.rel = "import";
                link.href = url;
                frag.appendChild(link)
            }
            importElements(frag, callback)
        } else if (callback) {
            callback()
        }
    }
    scope.import = _import;
    scope.importElements = importElements
}
)(Polymer);
(function() {
    var element = document.createElement("polymer-element");
    element.setAttribute("name", "auto-binding");
    element.setAttribute("extends", "template");
    element.init();
    Polymer("auto-binding", {
        createdCallback: function() {
            this.syntax = this.bindingDelegate = this.makeSyntax();
            Polymer.whenPolymerReady(function() {
                this.model = this;
                this.setAttribute("bind", "");
                this.async(function() {
                    this.marshalNodeReferences(this.parentNode);
                    this.fire("template-bound")
                }
                )
            }
            .bind(this))
        },
        makeSyntax: function() {
            var events = Object.create(Polymer.api.declaration.events);
            var self = this;
            events.findController = function() {
                return self.model
            }
            ;
            var syntax = new PolymerExpressions;
            var prepareBinding = syntax.prepareBinding;
            syntax.prepareBinding = function(pathString, name, node) {
                return events.prepareEventBinding(pathString, name, node) || prepareBinding.call(syntax, pathString, name, node)
            }
            ;
            return syntax
        }
    })
}
)();
(function(scope) {
    scope.CoreResizable = {
        resizableAttachedHandler: function(cb) {
            cb = cb || this._notifyResizeSelf;
            this.async(function() {
                var detail = {
                    callback: cb,
                    hasParentResizer: false
                };
                this.fire("core-request-resize", detail);
                if (!detail.hasParentResizer) {
                    this._boundWindowResizeHandler = cb.bind(this);
                    window.addEventListener("resize", this._boundWindowResizeHandler)
                }
            }
            .bind(this))
        },
        resizableDetachedHandler: function() {
            this.fire("core-request-resize-cancel", null , this, false);
            if (this._boundWindowResizeHandler) {
                window.removeEventListener("resize", this._boundWindowResizeHandler)
            }
        },
        _notifyResizeSelf: function() {
            return this.fire("core-resize", null , this, false).defaultPrevented
        }
    };
    scope.CoreResizer = Polymer.mixin({
        resizerAttachedHandler: function() {
            this.resizableAttachedHandler(this.notifyResize);
            this._boundResizeRequested = this._boundResizeRequested || this._handleResizeRequested.bind(this);
            var listener;
            if (this.resizerIsPeer) {
                listener = this.parentElement || this.parentNode && this.parentNode.host;
                listener._resizerPeers = listener._resizerPeers || [];
                listener._resizerPeers.push(this)
            } else {
                listener = this
            }
            listener.addEventListener("core-request-resize", this._boundResizeRequested);
            this._resizerListener = listener
        },
        resizerDetachedHandler: function() {
            this.resizableDetachedHandler();
            this._resizerListener.removeEventListener("core-request-resize", this._boundResizeRequested)
        },
        notifyResize: function() {
            if (!this._notifyResizeSelf()) {
                var r = this.resizeRequestors;
                if (r) {
                    for (var i = 0; i < r.length; i++) {
                        var ri = r[i];
                        if (!this.resizerShouldNotify || this.resizerShouldNotify(ri.target)) {
                            ri.callback.apply(ri.target)
                        }
                    }
                }
            }
        },
        _handleResizeRequested: function(e) {
            var target = e.path[0];
            if (target == this || target == this._resizerListener || this._resizerPeers && this._resizerPeers.indexOf(target) < 0) {
                return
            }
            if (!this.resizeRequestors) {
                this.resizeRequestors = []
            }
            this.resizeRequestors.push({
                target: target,
                callback: e.detail.callback
            });
            target.addEventListener("core-request-resize-cancel", this._cancelResizeRequested.bind(this));
            e.detail.hasParentResizer = true;
            e.stopPropagation()
        },
        _cancelResizeRequested: function(e) {
            if (this.resizeRequestors) {
                for (var i = 0; i < this.resizeRequestors.length; i++) {
                    if (this.resizeRequestors[i].target == e.target) {
                        this.resizeRequestors.splice(i, 1);
                        break
                    }
                }
            }
        }
    }, Polymer.CoreResizable)
}
)(Polymer);
Polymer.mixin2 = function(prototype, mixin) {
    if (mixin.mixinPublish) {
        prototype.publish = prototype.publish || {};
        Polymer.mixin(prototype.publish, mixin.mixinPublish)
    }
    if (mixin.mixinDelegates) {
        prototype.eventDelegates = prototype.eventDelegates || {};
        for (var e in mixin.mixinDelegates) {
            if (!prototype.eventDelegates[e]) {
                prototype.eventDelegates[e] = mixin.mixinDelegates[e]
            }
        }
    }
    if (mixin.mixinObserve) {
        prototype.observe = prototype.observe || {};
        for (var o in mixin.mixinObserve) {
            if (!prototype.observe[o] && !prototype[o + "Changed"]) {
                prototype.observe[o] = mixin.mixinObserve[o]
            }
        }
    }
    Polymer.mixin(prototype, mixin);
    delete prototype.mixinPublish;
    delete prototype.mixinDelegates;
    delete prototype.mixinObserve;
    return prototype
}
;
Polymer.CoreFocusable = {
    mixinPublish: {
        active: {
            value: false,
            reflect: true
        },
        focused: {
            value: false,
            reflect: true
        },
        pressed: {
            value: false,
            reflect: true
        },
        disabled: {
            value: false,
            reflect: true
        },
        toggle: false
    },
    mixinDelegates: {
        contextMenu: "_contextMenuAction",
        down: "_downAction",
        up: "_upAction",
        focus: "_focusAction",
        blur: "_blurAction"
    },
    mixinObserve: {
        disabled: "_disabledChanged"
    },
    _disabledChanged: function() {
        if (this.disabled) {
            this.style.pointerEvents = "none";
            this.removeAttribute("tabindex");
            this.setAttribute("aria-disabled", "")
        } else {
            this.style.pointerEvents = "";
            this.setAttribute("tabindex", 0);
            this.removeAttribute("aria-disabled")
        }
    },
    _downAction: function() {
        this.pressed = true;
        if (this.toggle) {
            this.active = !this.active
        } else {
            this.active = true
        }
    },
    _contextMenuAction: function(e) {
        this._upAction(e);
        this._focusAction()
    },
    _upAction: function() {
        this.pressed = false;
        if (!this.toggle) {
            this.active = false
        }
    },
    _focusAction: function() {
        if (!this.pressed) {
            this.focused = true
        }
    },
    _blurAction: function() {
        this.focused = false
    }
};
Polymer("paper-shadow", {
    publish: {
        z: 1,
        animated: false
    },
    setZ: function(newZ) {
        if (this.z !== newZ) {
            this.$["shadow-bottom"].classList.remove("paper-shadow-bottom-z-" + this.z);
            this.$["shadow-bottom"].classList.add("paper-shadow-bottom-z-" + newZ);
            this.$["shadow-top"].classList.remove("paper-shadow-top-z-" + this.z);
            this.$["shadow-top"].classList.add("paper-shadow-top-z-" + newZ);
            this.z = newZ
        }
    }
});
Polymer("core-selection", {
    multi: false,
    ready: function() {
        this.clear()
    },
    clear: function() {
        this.selection = []
    },
    getSelection: function() {
        return this.multi ? this.selection : this.selection[0]
    },
    isSelected: function(item) {
        return this.selection.indexOf(item) >= 0
    },
    setItemSelected: function(item, isSelected) {
        if (item !== undefined && item !== null ) {
            if (isSelected) {
                this.selection.push(item)
            } else {
                var i = this.selection.indexOf(item);
                if (i >= 0) {
                    this.selection.splice(i, 1)
                }
            }
            this.fire("core-select", {
                isSelected: isSelected,
                item: item
            })
        }
    },
    select: function(item) {
        if (this.multi) {
            this.toggle(item)
        } else if (this.getSelection() !== item) {
            this.setItemSelected(this.getSelection(), false);
            this.setItemSelected(item, true)
        }
    },
    toggle: function(item) {
        this.setItemSelected(item, !this.isSelected(item))
    }
});
Polymer("core-selector", {
    selected: null ,
    multi: false,
    valueattr: "name",
    selectedClass: "core-selected",
    selectedProperty: "",
    selectedAttribute: "active",
    selectedItem: null ,
    selectedModel: null ,
    selectedIndex: -1,
    excludedLocalNames: "",
    target: null ,
    itemsSelector: "",
    activateEvent: "tap",
    notap: false,
    defaultExcludedLocalNames: "template",
    observe: {
        "selected multi": "selectedChanged"
    },
    ready: function() {
        this.activateListener = this.activateHandler.bind(this);
        this.itemFilter = this.filterItem.bind(this);
        this.excludedLocalNamesChanged();
        this.observer = new MutationObserver(this.updateSelected.bind(this));
        if (!this.target) {
            this.target = this
        }
    },
    get items() {
        if (!this.target) {
            return []
        }
        var nodes = this.target !== this ? this.itemsSelector ? this.target.querySelectorAll(this.itemsSelector) : this.target.children : this.$.items.getDistributedNodes();
        return Array.prototype.filter.call(nodes, this.itemFilter)
    },
    filterItem: function(node) {
        return !this._excludedNames[node.localName]
    },
    excludedLocalNamesChanged: function() {
        this._excludedNames = {};
        var s = this.defaultExcludedLocalNames;
        if (this.excludedLocalNames) {
            s += " " + this.excludedLocalNames
        }
        s.split(/\s+/g).forEach(function(n) {
            this._excludedNames[n] = 1
        }
        , this)
    },
    targetChanged: function(old) {
        if (old) {
            this.removeListener(old);
            this.observer.disconnect();
            this.clearSelection()
        }
        if (this.target) {
            this.addListener(this.target);
            this.observer.observe(this.target, {
                childList: true
            });
            this.updateSelected()
        }
    },
    addListener: function(node) {
        Polymer.addEventListener(node, this.activateEvent, this.activateListener)
    },
    removeListener: function(node) {
        Polymer.removeEventListener(node, this.activateEvent, this.activateListener)
    },
    get selection() {
        return this.$.selection.getSelection()
    },
    selectedChanged: function() {
        if (arguments.length === 1) {
            this.processSplices(arguments[0])
        } else {
            this.updateSelected()
        }
    },
    updateSelected: function() {
        this.validateSelected();
        if (this.multi) {
            this.clearSelection(this.selected);
            this.selected && this.selected.forEach(function(s) {
                this.setValueSelected(s, true)
            }
            , this)
        } else {
            this.valueToSelection(this.selected)
        }
    },
    validateSelected: function() {
        if (this.multi && !Array.isArray(this.selected) && this.selected != null ) {
            this.selected = [this.selected]
        } else if (!this.multi && Array.isArray(this.selected)) {
            var s = this.selected[0];
            this.clearSelection([s]);
            this.selected = s
        }
    },
    processSplices: function(splices) {
        for (var i = 0, splice; splice = splices[i]; i++) {
            for (var j = 0; j < splice.removed.length; j++) {
                this.setValueSelected(splice.removed[j], false)
            }
            for (var j = 0; j < splice.addedCount; j++) {
                this.setValueSelected(this.selected[splice.index + j], true)
            }
        }
    },
    clearSelection: function(excludes) {
        this.$.selection.selection.slice().forEach(function(item) {
            var v = this.valueForNode(item) || this.items.indexOf(item);
            if (!excludes || excludes.indexOf(v) < 0) {
                this.$.selection.setItemSelected(item, false)
            }
        }
        , this)
    },
    valueToSelection: function(value) {
        var item = this.valueToItem(value);
        this.$.selection.select(item)
    },
    setValueSelected: function(value, isSelected) {
        var item = this.valueToItem(value);
        if (isSelected ^ this.$.selection.isSelected(item)) {
            this.$.selection.setItemSelected(item, isSelected)
        }
    },
    updateSelectedItem: function() {
        this.selectedItem = this.selection
    },
    selectedItemChanged: function() {
        if (this.selectedItem) {
            var t = this.selectedItem.templateInstance;
            this.selectedModel = t ? t.model : undefined
        } else {
            this.selectedModel = null 
        }
        this.selectedIndex = this.selectedItem ? parseInt(this.valueToIndex(this.selected)) : -1
    },
    valueToItem: function(value) {
        return value === null  || value === undefined ? null  : this.items[this.valueToIndex(value)]
    },
    valueToIndex: function(value) {
        for (var i = 0, items = this.items, c; c = items[i]; i++) {
            if (this.valueForNode(c) == value) {
                return i
            }
        }
        return value
    },
    valueForNode: function(node) {
        return node[this.valueattr] || node.getAttribute(this.valueattr)
    },
    selectionSelect: function(e, detail) {
        this.updateSelectedItem();
        if (detail.item) {
            this.applySelection(detail.item, detail.isSelected)
        }
    },
    applySelection: function(item, isSelected) {
        if (this.selectedClass) {
            item.classList.toggle(this.selectedClass, isSelected)
        }
        if (this.selectedProperty) {
            item[this.selectedProperty] = isSelected
        }
        if (this.selectedAttribute && item.setAttribute) {
            if (isSelected) {
                item.setAttribute(this.selectedAttribute, "")
            } else {
                item.removeAttribute(this.selectedAttribute)
            }
        }
    },
    activateHandler: function(e) {
        if (!this.notap) {
            var i = this.findDistributedTarget(e.target, this.items);
            if (i >= 0) {
                var item = this.items[i];
                var s = this.valueForNode(item) || i;
                if (this.multi) {
                    if (this.selected) {
                        this.addRemoveSelected(s)
                    } else {
                        this.selected = [s]
                    }
                } else {
                    this.selected = s
                }
                this.asyncFire("core-activate", {
                    item: item
                })
            }
        }
    },
    addRemoveSelected: function(value) {
        var i = this.selected.indexOf(value);
        if (i >= 0) {
            this.selected.splice(i, 1)
        } else {
            this.selected.push(value)
        }
    },
    findDistributedTarget: function(target, nodes) {
        while (target && target != this) {
            var i = Array.prototype.indexOf.call(nodes, target);
            if (i >= 0) {
                return i
            }
            target = target.parentNode
        }
    },
    selectIndex: function(index) {
        var item = this.items[index];
        if (item) {
            this.selected = this.valueForNode(item) || index;
            return item
        }
    },
    selectPrevious: function(wrapped) {
        var i = wrapped && !this.selectedIndex ? this.items.length - 1 : this.selectedIndex - 1;
        return this.selectIndex(i)
    },
    selectNext: function(wrapped) {
        var i = wrapped && this.selectedIndex >= this.items.length - 1 ? 0 : this.selectedIndex + 1;
        return this.selectIndex(i)
    }
});
(function() {
    window.CoreStyle = window.CoreStyle || {
        g: {},
        list: {},
        refMap: {}
    };
    Polymer("core-style", {
        publish: {
            ref: ""
        },
        g: CoreStyle.g,
        refMap: CoreStyle.refMap,
        list: CoreStyle.list,
        ready: function() {
            if (this.id) {
                this.provide()
            } else {
                this.registerRef(this.ref);
                if (!window.ShadowDOMPolyfill) {
                    this.require()
                }
            }
        },
        attached: function() {
            if (!this.id && window.ShadowDOMPolyfill) {
                this.require()
            }
        },
        provide: function() {
            this.register();
            if (this.textContent) {
                this._completeProvide()
            } else {
                this.async(this._completeProvide)
            }
        },
        register: function() {
            var i = this.list[this.id];
            if (i) {
                if (!Array.isArray(i)) {
                    this.list[this.id] = [i]
                }
                this.list[this.id].push(this)
            } else {
                this.list[this.id] = this
            }
        },
        _completeProvide: function() {
            this.createShadowRoot();
            this.domObserver = new MutationObserver(this.domModified.bind(this)).observe(this.shadowRoot, {
                subtree: true,
                characterData: true,
                childList: true
            });
            this.provideContent()
        },
        provideContent: function() {
            this.ensureTemplate();
            this.shadowRoot.textContent = "";
            this.shadowRoot.appendChild(this.instanceTemplate(this.template));
            this.cssText = this.shadowRoot.textContent
        },
        ensureTemplate: function() {
            if (!this.template) {
                this.template = this.querySelector("template:not([repeat]):not([bind])");
                if (!this.template) {
                    this.template = document.createElement("template");
                    var n = this.firstChild;
                    while (n) {
                        this.template.content.appendChild(n.cloneNode(true));
                        n = n.nextSibling
                    }
                }
            }
        },
        domModified: function() {
            this.cssText = this.shadowRoot.textContent;
            this.notify()
        },
        notify: function() {
            var s$ = this.refMap[this.id];
            if (s$) {
                for (var i = 0, s; s = s$[i]; i++) {
                    s.require()
                }
            }
        },
        registerRef: function(ref) {
            this.refMap[this.ref] = this.refMap[this.ref] || [];
            this.refMap[this.ref].push(this)
        },
        applyRef: function(ref) {
            this.ref = ref;
            this.registerRef(this.ref);
            this.require()
        },
        require: function() {
            var cssText = this.cssTextForRef(this.ref);
            if (cssText) {
                this.ensureStyleElement();
                if (this.styleElement._cssText === cssText) {
                    return
                }
                this.styleElement._cssText = cssText;
                if (window.ShadowDOMPolyfill) {
                    this.styleElement.textContent = cssText;
                    cssText = WebComponents.ShadowCSS.shimStyle(this.styleElement, this.getScopeSelector())
                }
                this.styleElement.textContent = cssText
            }
        },
        cssTextForRef: function(ref) {
            var s$ = this.byId(ref);
            var cssText = "";
            if (s$) {
                if (Array.isArray(s$)) {
                    var p = [];
                    for (var i = 0, l = s$.length, s; i < l && (s = s$[i]); i++) {
                        p.push(s.cssText)
                    }
                    cssText = p.join("\n\n")
                } else {
                    cssText = s$.cssText
                }
            }
            if (s$ && !cssText) {
                console.warn("No styles provided for ref:", ref)
            }
            return cssText
        },
        byId: function(id) {
            return this.list[id]
        },
        ensureStyleElement: function() {
            if (!this.styleElement) {
                this.styleElement = window.ShadowDOMPolyfill ? this.makeShimStyle() : this.makeRootStyle()
            }
            if (!this.styleElement) {
                console.warn(this.localName, "could not setup style.")
            }
        },
        makeRootStyle: function() {
            var style = document.createElement("style");
            this.appendChild(style);
            return style
        },
        makeShimStyle: function() {
            var host = this.findHost(this);
            if (host) {
                var name = host.localName;
                var style = document.querySelector("style[" + name + "=" + this.ref + "]");
                if (!style) {
                    style = document.createElement("style");
                    style.setAttribute(name, this.ref);
                    document.head.appendChild(style)
                }
                return style
            }
        },
        getScopeSelector: function() {
            if (!this._scopeSelector) {
                var selector = ""
                  , host = this.findHost(this);
                if (host) {
                    var typeExtension = host.hasAttribute("is");
                    var name = typeExtension ? host.getAttribute("is") : host.localName;
                    selector = WebComponents.ShadowCSS.makeScopeSelector(name, typeExtension)
                }
                this._scopeSelector = selector
            }
            return this._scopeSelector
        },
        findHost: function(node) {
            while (node.parentNode) {
                node = node.parentNode
            }
            return node.host || wrap(document.documentElement)
        },
        cycle: function(rgb, amount) {
            if (rgb.match("#")) {
                var o = this.hexToRgb(rgb);
                if (!o) {
                    return rgb
                }
                rgb = "rgb(" + o.r + "," + o.b + "," + o.g + ")"
            }
            function cycleChannel(v) {
                return Math.abs((Number(v) - amount) % 255)
            }
            return rgb.replace(/rgb\(([^,]*),([^,]*),([^,]*)\)/, function(m, a, b, c) {
                return "rgb(" + cycleChannel(a) + "," + cycleChannel(b) + ", " + cycleChannel(c) + ")"
            }
            )
        },
        hexToRgb: function(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null 
        }
    })
}
)();
(function() {
    var SKIP_ID = "meta";
    var metaData = {}
      , metaArray = {};
    Polymer("core-meta", {
        type: "default",
        alwaysPrepare: true,
        ready: function() {
            this.register(this.id)
        },
        get metaArray() {
            var t = this.type;
            if (!metaArray[t]) {
                metaArray[t] = []
            }
            return metaArray[t]
        },
        get metaData() {
            var t = this.type;
            if (!metaData[t]) {
                metaData[t] = {}
            }
            return metaData[t]
        },
        register: function(id, old) {
            if (id && id !== SKIP_ID) {
                this.unregister(this, old);
                this.metaData[id] = this;
                this.metaArray.push(this)
            }
        },
        unregister: function(meta, id) {
            delete this.metaData[id || meta.id];
            var i = this.metaArray.indexOf(meta);
            if (i >= 0) {
                this.metaArray.splice(i, 1)
            }
        },
        get list() {
            return this.metaArray
        },
        byId: function(id) {
            return this.metaData[id]
        }
    })
}
)();
Polymer("core-transition", {
    type: "transition",
    go: function(node, state) {
        this.complete(node)
    },
    setup: function(node) {},
    teardown: function(node) {},
    complete: function(node) {
        this.fire("core-transitionend", null , node)
    },
    listenOnce: function(node, event, fn, args) {
        var self = this;
        var listener = function() {
            fn.apply(self, args);
            node.removeEventListener(event, listener, false)
        }
        ;
        node.addEventListener(event, listener, false)
    }
});
(function() {
    var transitions = CoreStyle.g.transitions = CoreStyle.g.transitions || {};
    transitions.duration = "500ms";
    transitions.heroDelay = "50ms";
    transitions.scaleDelay = "500ms";
    transitions.cascadeFadeDuration = "250ms";
    Polymer("core-transition-pages", {
        publish: {
            scopeClass: "",
            activeClass: "",
            transitionProperty: ""
        },
        completed: false,
        prepare: function(scope, options) {
            this.boundCompleteFn = this.complete.bind(this, scope);
            if (this.scopeClass) {
                scope.classList.add(this.scopeClass)
            }
        },
        go: function(scope, options) {
            this.completed = false;
            if (this.activeClass) {
                scope.classList.add(this.activeClass)
            }
            scope.addEventListener("transitionend", this.boundCompleteFn, false)
        },
        setup: function(scope) {
            if (!scope._pageTransitionStyles) {
                scope._pageTransitionStyles = {}
            }
            var name = this.calcStyleName();
            if (!scope._pageTransitionStyles[name]) {
                this.installStyleInScope(scope, name);
                scope._pageTransitionStyles[name] = true
            }
        },
        calcStyleName: function() {
            return this.id || this.localName
        },
        installStyleInScope: function(scope, id) {
            if (!scope.shadowRoot) {
                scope.createShadowRoot().innerHTML = "<content></content>"
            }
            var root = scope.shadowRoot;
            var scopeStyle = document.createElement("core-style");
            root.insertBefore(scopeStyle, root.firstChild);
            scopeStyle.applyRef(id)
        },
        complete: function(scope, e) {
            if (e.propertyName !== "box-shadow" && (!this.transitionProperty || e.propertyName.indexOf(this.transitionProperty) !== -1)) {
                this.completed = true;
                this.fire("core-transitionend", this, scope)
            }
        },
        ensureComplete: function(scope) {
            scope.removeEventListener("transitionend", this.boundCompleteFn, false);
            if (this.scopeClass) {
                scope.classList.remove(this.scopeClass)
            }
            if (this.activeClass) {
                scope.classList.remove(this.activeClass)
            }
        }
    })
}
)();
(function() {
    var webkitStyles = "-webkit-transition" in document.documentElement.style;
    var TRANSITION_CSSNAME = webkitStyles ? "-webkit-transition" : "transition";
    var TRANSFORM_CSSNAME = webkitStyles ? "-webkit-transform" : "transform";
    var TRANSITION_NAME = webkitStyles ? "webkitTransition" : "transition";
    var TRANSFORM_NAME = webkitStyles ? "webkitTransform" : "transform";
    var hasShadowDOMPolyfill = window.ShadowDOMPolyfill;
    Polymer("hero-transition", {
        go: function(scope, options) {
            var props = ["border-radius", "width", "height", TRANSFORM_CSSNAME];
            var duration = options && options.duration || (CoreStyle.g.transitions.heroDuration || CoreStyle.g.transitions.duration);
            scope._heroes.forEach(function(h) {
                var d = h.h0.hasAttribute("hero-delayed") ? CoreStyle.g.transitions.heroDelay : "";
                var wt = [];
                props.forEach(function(p) {
                    wt.push(p + " " + duration + " " + options.easing + " " + d)
                }
                );
                h.h1.style[TRANSITION_NAME] = wt.join(", ");
                h.h1.style.borderRadius = h.r1;
                h.h1.style[TRANSFORM_NAME] = ""
            }
            );
            this.super(arguments);
            if (!scope._heroes.length) {
                this.completed = true
            }
        },
        prepare: function(scope, options) {
            this.super(arguments);
            var src = options.src
              , dst = options.dst;
            if (scope._heroes && scope._heroes.length) {
                this.ensureComplete(scope)
            } else {
                scope._heroes = []
            }
            var ss = "[hero]";
            var h$ = this.findAllInShadows(src, ss);
            if (src.selectedItem) {
                hs$ = this.findAllInShadows(src.selectedItem, ss);
                hsa$ = [];
                Array.prototype.forEach.call(hs$, function(hs) {
                    if (h$.indexOf(hs) === -1) {
                        hsa$.push(hs)
                    }
                }
                );
                h$ = h$.concat(hsa$)
            }
            for (var i = 0, h0; h0 = h$[i]; i++) {
                var v = h0.getAttribute("hero-id");
                var ds = '[hero][hero-id="' + v + '"]';
                var h1 = this.findInShadows(dst, ds);
                if (!h1 && dst.selectedItem) {
                    h1 = this.findInShadows(dst.selectedItem, ds)
                }
                if (v && h1) {
                    var c0 = getComputedStyle(h0);
                    var c1 = getComputedStyle(h1);
                    var h = {
                        h0: h0,
                        b0: h0.getBoundingClientRect(),
                        r0: c0.borderRadius,
                        h1: h1,
                        b1: h1.getBoundingClientRect(),
                        r1: c1.borderRadius
                    };
                    var dl = h.b0.left - h.b1.left;
                    var dt = h.b0.top - h.b1.top;
                    var sw = h.b0.width / h.b1.width;
                    var sh = h.b0.height / h.b1.height;
                    if (h.r0 !== h.r1) {
                        h.h1.style.borderRadius = h.r0
                    }
                    h.h1.style[TRANSFORM_NAME] = "translate(" + dl + "px," + dt + "px)" + " scale(" + sw + "," + sh + ")";
                    h.h1.style[TRANSFORM_NAME + "Origin"] = "0 0";
                    scope._heroes.push(h)
                }
            }
        },
        findInShadows: function(node, selector) {
            return node.querySelector(selector) || (hasShadowDOMPolyfill ? queryAllShadows(node, selector) : node.querySelector("::shadow " + selector))
        },
        findAllInShadows: function(node, selector) {
            if (hasShadowDOMPolyfill) {
                var nodes = node.querySelectorAll(selector).array();
                var shadowNodes = queryAllShadows(node, selector, true);
                return nodes.concat(shadowNodes)
            } else {
                return node.querySelectorAll(selector).array().concat(node.shadowRoot ? node.shadowRoot.querySelectorAll(selector).array() : [])
            }
        },
        ensureComplete: function(scope) {
            this.super(arguments);
            if (scope._heroes) {
                scope._heroes.forEach(function(h) {
                    h.h1.style[TRANSITION_NAME] = "";
                    h.h1.style[TRANSFORM_NAME] = ""
                }
                );
                scope._heroes = []
            }
        },
        complete: function(scope, e) {
            var done = false;
            scope._heroes.forEach(function(h) {
                if (h.h1 === e.path[0]) {
                    done = true
                }
            }
            );
            if (done) {
                this.super(arguments)
            }
        }
    });
    function queryShadow(node, selector) {
        var m, el = node.firstElementChild;
        var shadows, sr, i;
        shadows = [];
        sr = node.shadowRoot;
        while (sr) {
            shadows.push(sr);
            sr = sr.olderShadowRoot
        }
        for (i = shadows.length - 1; i >= 0; i--) {
            m = shadows[i].querySelector(selector);
            if (m) {
                return m
            }
        }
        while (el) {
            m = queryShadow(el, selector);
            if (m) {
                return m
            }
            el = el.nextElementSibling
        }
        return null 
    }
    function _queryAllShadows(node, selector, results) {
        var el = node.firstElementChild;
        var temp, sr, shadows, i, j;
        shadows = [];
        sr = node.shadowRoot;
        while (sr) {
            shadows.push(sr);
            sr = sr.olderShadowRoot
        }
        for (i = shadows.length - 1; i >= 0; i--) {
            temp = shadows[i].querySelectorAll(selector);
            for (j = 0; j < temp.length; j++) {
                results.push(temp[j])
            }
        }
        while (el) {
            _queryAllShadows(el, selector, results);
            el = el.nextElementSibling
        }
        return results
    }
    queryAllShadows = function(node, selector, all) {
        if (all) {
            return _queryAllShadows(node, selector, [])
        } else {
            return queryShadow(node, selector)
        }
    }
}
)();
Polymer("core-animated-pages", Polymer.mixin({
    eventDelegates: {
        "core-transitionend": "transitionEnd"
    },
    transitions: "",
    selected: 0,
    lastSelected: null ,
    registerCallback: function() {
        this.tmeta = document.createElement("core-transition")
    },
    created: function() {
        this._transitions = [];
        this.transitioning = []
    },
    attached: function() {
        this.resizerAttachedHandler()
    },
    detached: function() {
        this.resizerDetachedHandler()
    },
    transitionsChanged: function() {
        this._transitions = this.transitions.split(" ")
    },
    _transitionsChanged: function(old) {
        if (this._transitionElements) {
            this._transitionElements.forEach(function(t) {
                t.teardown(this)
            }
            , this)
        }
        this._transitionElements = [];
        this._transitions.forEach(function(transitionId) {
            var t = this.getTransition(transitionId);
            if (t) {
                this._transitionElements.push(t);
                t.setup(this)
            }
        }
        , this)
    },
    getTransition: function(transitionId) {
        return this.tmeta.byId(transitionId)
    },
    selectionSelect: function(e, detail) {
        this.updateSelectedItem()
    },
    applyTransition: function(src, dst) {
        if (this.animating) {
            this.cancelAsync(this.animating);
            this.animating = null 
        }
        Polymer.flush();
        if (this.transitioning.indexOf(src) === -1) {
            this.transitioning.push(src)
        }
        if (this.transitioning.indexOf(dst) === -1) {
            this.transitioning.push(dst)
        }
        src.setAttribute("animate", "");
        dst.setAttribute("animate", "");
        var options = {
            src: src,
            dst: dst,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)"
        };
        this.fire("core-animated-pages-transition-prepare");
        this._transitionElements.forEach(function(transition) {
            transition.prepare(this, options)
        }
        , this);
        src.offsetTop;
        this.applySelection(dst, true);
        this.applySelection(src, false);
        this._transitionElements.forEach(function(transition) {
            transition.go(this, options)
        }
        , this);
        if (!this._transitionElements.length) {
            this.complete()
        } else {
            this.animating = this.async(this.complete.bind(this), null , 5e3)
        }
    },
    complete: function() {
        if (this.animating) {
            this.cancelAsync(this.animating);
            this.animating = null 
        }
        this.transitioning.forEach(function(t) {
            t.removeAttribute("animate")
        }
        );
        this.transitioning = [];
        this._transitionElements.forEach(function(transition) {
            transition.ensureComplete(this)
        }
        , this);
        this.fire("core-animated-pages-transition-end")
    },
    transitionEnd: function(e) {
        if (this.transitioning.length) {
            var completed = true;
            this._transitionElements.forEach(function(transition) {
                if (!transition.completed) {
                    completed = false
                }
            }
            );
            if (completed) {
                this.job("transitionWatch", function() {
                    this.complete()
                }
                , 100)
            }
        }
    },
    selectedChanged: function(old) {
        this.lastSelected = old;
        this.super(arguments)
    },
    selectedItemChanged: function(oldItem) {
        this.super(arguments);
        if (!oldItem) {
            this.applySelection(this.selectedItem, true);
            this.async(this.notifyResize);
            return
        }
        if (this.hasAttribute("no-transition") || !this._transitionElements || !this._transitionElements.length) {
            this.applySelection(oldItem, false);
            this.applySelection(this.selectedItem, true);
            this.notifyResize();
            return
        }
        if (oldItem && this.selectedItem) {
            var self = this;
            Polymer.flush();
            Polymer.endOfMicrotask(function() {
                self.applyTransition(oldItem, self.selectedItem);
                self.notifyResize()
            }
            )
        }
    },
    resizerShouldNotify: function(el) {
        while (el && el != this) {
            if (el == this.selectedItem) {
                return true
            }
            el = el.parentElement || el.parentNode && el.parentNode.host
        }
    }
}, Polymer.CoreResizer));
Polymer("core-iconset", {
    src: "",
    width: 0,
    icons: "",
    iconSize: 24,
    offsetX: 0,
    offsetY: 0,
    type: "iconset",
    created: function() {
        this.iconMap = {};
        this.iconNames = [];
        this.themes = {}
    },
    ready: function() {
        if (this.src && this.ownerDocument !== document) {
            this.src = this.resolvePath(this.src, this.ownerDocument.baseURI)
        }
        this.super();
        this.updateThemes()
    },
    iconsChanged: function() {
        var ox = this.offsetX;
        var oy = this.offsetY;
        this.icons && this.icons.split(/\s+/g).forEach(function(name, i) {
            this.iconNames.push(name);
            this.iconMap[name] = {
                offsetX: ox,
                offsetY: oy
            };
            if (ox + this.iconSize < this.width) {
                ox += this.iconSize
            } else {
                ox = this.offsetX;
                oy += this.iconSize
            }
        }
        , this)
    },
    updateThemes: function() {
        var ts = this.querySelectorAll("property[theme]");
        ts && ts.array().forEach(function(t) {
            this.themes[t.getAttribute("theme")] = {
                offsetX: parseInt(t.getAttribute("offsetX")) || 0,
                offsetY: parseInt(t.getAttribute("offsetY")) || 0
            }
        }
        , this)
    },
    getOffset: function(icon, theme) {
        var i = this.iconMap[icon];
        if (!i) {
            var n = this.iconNames[Number(icon)];
            i = this.iconMap[n]
        }
        var t = this.themes[theme];
        if (i && t) {
            return {
                offsetX: i.offsetX + t.offsetX,
                offsetY: i.offsetY + t.offsetY
            }
        }
        return i
    },
    applyIcon: function(element, icon, scale) {
        var offset = this.getOffset(icon);
        scale = scale || 1;
        if (element && offset) {
            icon = element._icon || document.createElement("div");
            var style = icon.style;
            style.backgroundImage = "url(" + this.src + ")";
            style.backgroundPosition = -offset.offsetX * scale + "px" + " " + (-offset.offsetY * scale + "px");
            style.backgroundSize = scale === 1 ? "auto" : this.width * scale + "px";
            if (icon.parentNode !== element) {
                element.appendChild(icon)
            }
            return icon
        }
    }
});
(function() {
    var meta;
    Polymer("core-icon", {
        src: "",
        icon: "",
        alt: null ,
        observe: {
            icon: "updateIcon",
            alt: "updateAlt"
        },
        defaultIconset: "icons",
        ready: function() {
            if (!meta) {
                meta = document.createElement("core-iconset")
            }
            if (this.hasAttribute("aria-label")) {
                if (!this.hasAttribute("role")) {
                    this.setAttribute("role", "img")
                }
                return
            }
            this.updateAlt()
        },
        srcChanged: function() {
            var icon = this._icon || document.createElement("div");
            icon.textContent = "";
            icon.setAttribute("fit", "");
            icon.style.backgroundImage = "url(" + this.src + ")";
            icon.style.backgroundPosition = "center";
            icon.style.backgroundSize = "100%";
            if (!icon.parentNode) {
                this.appendChild(icon)
            }
            this._icon = icon
        },
        getIconset: function(name) {
            return meta.byId(name || this.defaultIconset)
        },
        updateIcon: function(oldVal, newVal) {
            if (!this.icon) {
                this.updateAlt();
                return
            }
            var parts = String(this.icon).split(":");
            var icon = parts.pop();
            if (icon) {
                var set = this.getIconset(parts.pop());
                if (set) {
                    this._icon = set.applyIcon(this, icon);
                    if (this._icon) {
                        this._icon.setAttribute("fit", "")
                    }
                }
            }
            if (oldVal) {
                if (oldVal.split(":").pop() == this.getAttribute("aria-label")) {
                    this.updateAlt()
                }
            }
        },
        updateAlt: function() {
            if (this.getAttribute("aria-hidden")) {
                return
            }
            if (this.alt === "") {
                this.setAttribute("aria-hidden", "true");
                if (this.hasAttribute("role")) {
                    this.removeAttribute("role")
                }
                if (this.hasAttribute("aria-label")) {
                    this.removeAttribute("aria-label")
                }
            } else {
                this.setAttribute("aria-label", this.alt || this.icon.split(":").pop());
                if (!this.hasAttribute("role")) {
                    this.setAttribute("role", "img")
                }
                if (this.hasAttribute("aria-hidden")) {
                    this.removeAttribute("aria-hidden")
                }
            }
        }
    })
}
)();
Polymer("core-iconset-svg", {
    iconSize: 24,
    type: "iconset",
    created: function() {
        this._icons = {}
    },
    ready: function() {
        this.super();
        this.updateIcons()
    },
    iconById: function(id) {
        return this._icons[id] || (this._icons[id] = this.querySelector('[id="' + id + '"]'))
    },
    cloneIcon: function(id) {
        var icon = this.iconById(id);
        if (icon) {
            var content = icon.cloneNode(true);
            content.removeAttribute("id");
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 " + this.iconSize + " " + this.iconSize);
            svg.style.pointerEvents = "none";
            svg.appendChild(content);
            return svg
        }
    },
    get iconNames() {
        if (!this._iconNames) {
            this._iconNames = this.findIconNames()
        }
        return this._iconNames
    },
    findIconNames: function() {
        var icons = this.querySelectorAll("[id]").array();
        if (icons.length) {
            return icons.map(function(n) {
                return n.id
            }
            )
        }
    },
    applyIcon: function(element, icon) {
        var root = element;
        var old = root.querySelector("svg");
        if (old) {
            old.remove()
        }
        var svg = this.cloneIcon(icon);
        if (!svg) {
            return
        }
        svg.setAttribute("height", "100%");
        svg.setAttribute("width", "100%");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.style.display = "block";
        root.insertBefore(svg, root.firstElementChild);
        return svg
    },
    updateIcons: function(selector, method) {
        selector = selector || "[icon]";
        method = method || "updateIcon";
        var deep = window.ShadowDOMPolyfill ? "" : "html /deep/ ";
        var i$ = document.querySelectorAll(deep + selector);
        for (var i = 0, e; e = i$[i]; i++) {
            if (e[method]) {
                e[method].call(e)
            }
        }
    }
});
(function() {
    var waveMaxRadius = 150;
    function waveRadiusFn(touchDownMs, touchUpMs, anim) {
        var touchDown = touchDownMs / 1e3;
        var touchUp = touchUpMs / 1e3;
        var totalElapsed = touchDown + touchUp;
        var ww = anim.width
          , hh = anim.height;
        var waveRadius = Math.min(Math.sqrt(ww * ww + hh * hh), waveMaxRadius) * 1.1 + 5;
        var duration = 1.1 - .2 * (waveRadius / waveMaxRadius);
        var tt = totalElapsed / duration;
        var size = waveRadius * (1 - Math.pow(80, -tt));
        return Math.abs(size)
    }
    function waveOpacityFn(td, tu, anim) {
        var touchDown = td / 1e3;
        var touchUp = tu / 1e3;
        var totalElapsed = touchDown + touchUp;
        if (tu <= 0) {
            return anim.initialOpacity
        }
        return Math.max(0, anim.initialOpacity - touchUp * anim.opacityDecayVelocity)
    }
    function waveOuterOpacityFn(td, tu, anim) {
        var touchDown = td / 1e3;
        var touchUp = tu / 1e3;
        var outerOpacity = touchDown * .3;
        var waveOpacity = waveOpacityFn(td, tu, anim);
        return Math.max(0, Math.min(outerOpacity, waveOpacity))
    }
    function waveDidFinish(wave, radius, anim) {
        var waveOpacity = waveOpacityFn(wave.tDown, wave.tUp, anim);
        return waveOpacity < .01 && radius >= Math.min(wave.maxRadius, waveMaxRadius)
    }
    function waveAtMaximum(wave, radius, anim) {
        var waveOpacity = waveOpacityFn(wave.tDown, wave.tUp, anim);
        return waveOpacity >= anim.initialOpacity && radius >= Math.min(wave.maxRadius, waveMaxRadius)
    }
    function drawRipple(ctx, x, y, radius, innerAlpha, outerAlpha) {
        if (outerAlpha !== undefined) {
            ctx.bg.style.opacity = outerAlpha
        }
        ctx.wave.style.opacity = innerAlpha;
        var s = radius / (ctx.containerSize / 2);
        var dx = x - ctx.containerWidth / 2;
        var dy = y - ctx.containerHeight / 2;
        ctx.wc.style.webkitTransform = "translate3d(" + dx + "px," + dy + "px,0)";
        ctx.wc.style.transform = "translate3d(" + dx + "px," + dy + "px,0)";
        ctx.wave.style.webkitTransform = "scale(" + s + "," + s + ")";
        ctx.wave.style.transform = "scale3d(" + s + "," + s + ",1)"
    }
    function createWave(elem) {
        var elementStyle = window.getComputedStyle(elem);
        var fgColor = elementStyle.color;
        var inner = document.createElement("div");
        inner.style.backgroundColor = fgColor;
        inner.classList.add("wave");
        var outer = document.createElement("div");
        outer.classList.add("wave-container");
        outer.appendChild(inner);
        var container = elem.$.waves;
        container.appendChild(outer);
        elem.$.bg.style.backgroundColor = fgColor;
        var wave = {
            bg: elem.$.bg,
            wc: outer,
            wave: inner,
            waveColor: fgColor,
            maxRadius: 0,
            isMouseDown: false,
            mouseDownStart: 0,
            mouseUpStart: 0,
            tDown: 0,
            tUp: 0
        };
        return wave
    }
    function removeWaveFromScope(scope, wave) {
        if (scope.waves) {
            var pos = scope.waves.indexOf(wave);
            scope.waves.splice(pos, 1);
            wave.wc.remove()
        }
    }
    var pow = Math.pow;
    var now = Date.now;
    if (window.performance && performance.now) {
        now = performance.now.bind(performance)
    }
    function cssColorWithAlpha(cssColor, alpha) {
        var parts = cssColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (typeof alpha == "undefined") {
            alpha = 1
        }
        if (!parts) {
            return "rgba(255, 255, 255, " + alpha + ")"
        }
        return "rgba(" + parts[1] + ", " + parts[2] + ", " + parts[3] + ", " + alpha + ")"
    }
    function dist(p1, p2) {
        return Math.sqrt(pow(p1.x - p2.x, 2) + pow(p1.y - p2.y, 2))
    }
    function distanceFromPointToFurthestCorner(point, size) {
        var tl_d = dist(point, {
            x: 0,
            y: 0
        });
        var tr_d = dist(point, {
            x: size.w,
            y: 0
        });
        var bl_d = dist(point, {
            x: 0,
            y: size.h
        });
        var br_d = dist(point, {
            x: size.w,
            y: size.h
        });
        return Math.max(tl_d, tr_d, bl_d, br_d)
    }
    Polymer("paper-ripple", {
        initialOpacity: .25,
        opacityDecayVelocity: .8,
        backgroundFill: true,
        pixelDensity: 2,
        eventDelegates: {
            down: "downAction",
            up: "upAction"
        },
        ready: function() {
            this.waves = []
        },
        downAction: function(e) {
            var wave = createWave(this);
            this.cancelled = false;
            wave.isMouseDown = true;
            wave.tDown = 0;
            wave.tUp = 0;
            wave.mouseUpStart = 0;
            wave.mouseDownStart = now();
            var rect = this.getBoundingClientRect();
            var width = rect.width;
            var height = rect.height;
            var touchX = e.x - rect.left;
            var touchY = e.y - rect.top;
            wave.startPosition = {
                x: touchX,
                y: touchY
            };
            if (this.classList.contains("recenteringTouch")) {
                wave.endPosition = {
                    x: width / 2,
                    y: height / 2
                };
                wave.slideDistance = dist(wave.startPosition, wave.endPosition)
            }
            wave.containerSize = Math.max(width, height);
            wave.containerWidth = width;
            wave.containerHeight = height;
            wave.maxRadius = distanceFromPointToFurthestCorner(wave.startPosition, {
                w: width,
                h: height
            });
            wave.wc.style.top = (wave.containerHeight - wave.containerSize) / 2 + "px";
            wave.wc.style.left = (wave.containerWidth - wave.containerSize) / 2 + "px";
            wave.wc.style.width = wave.containerSize + "px";
            wave.wc.style.height = wave.containerSize + "px";
            this.waves.push(wave);
            if (!this._loop) {
                this._loop = this.animate.bind(this, {
                    width: width,
                    height: height
                });
                requestAnimationFrame(this._loop)
            }
        },
        upAction: function() {
            for (var i = 0; i < this.waves.length; i++) {
                var wave = this.waves[i];
                if (wave.isMouseDown) {
                    wave.isMouseDown = false;
                    wave.mouseUpStart = now();
                    wave.mouseDownStart = 0;
                    wave.tUp = 0;
                    break
                }
            }
            this._loop && requestAnimationFrame(this._loop)
        },
        cancel: function() {
            this.cancelled = true
        },
        animate: function(ctx) {
            var shouldRenderNextFrame = false;
            var deleteTheseWaves = [];
            var longestTouchDownDuration = 0;
            var longestTouchUpDuration = 0;
            var lastWaveColor = null ;
            var anim = {
                initialOpacity: this.initialOpacity,
                opacityDecayVelocity: this.opacityDecayVelocity,
                height: ctx.height,
                width: ctx.width
            };
            for (var i = 0; i < this.waves.length; i++) {
                var wave = this.waves[i];
                if (wave.mouseDownStart > 0) {
                    wave.tDown = now() - wave.mouseDownStart
                }
                if (wave.mouseUpStart > 0) {
                    wave.tUp = now() - wave.mouseUpStart
                }
                var tUp = wave.tUp;
                var tDown = wave.tDown;
                longestTouchDownDuration = Math.max(longestTouchDownDuration, tDown);
                longestTouchUpDuration = Math.max(longestTouchUpDuration, tUp);
                var radius = waveRadiusFn(tDown, tUp, anim);
                var waveAlpha = waveOpacityFn(tDown, tUp, anim);
                var waveColor = cssColorWithAlpha(wave.waveColor, waveAlpha);
                lastWaveColor = wave.waveColor;
                var x = wave.startPosition.x;
                var y = wave.startPosition.y;
                if (wave.endPosition) {
                    var translateFraction = Math.min(1, radius / wave.containerSize * 2 / Math.sqrt(2));
                    x += translateFraction * (wave.endPosition.x - wave.startPosition.x);
                    y += translateFraction * (wave.endPosition.y - wave.startPosition.y)
                }
                var bgFillColor = null ;
                if (this.backgroundFill) {
                    var bgFillAlpha = waveOuterOpacityFn(tDown, tUp, anim);
                    bgFillColor = cssColorWithAlpha(wave.waveColor, bgFillAlpha)
                }
                drawRipple(wave, x, y, radius, waveAlpha, bgFillAlpha);
                var maximumWave = waveAtMaximum(wave, radius, anim);
                var waveDissipated = waveDidFinish(wave, radius, anim);
                var shouldKeepWave = !waveDissipated || maximumWave;
                var shouldRenderWaveAgain = wave.mouseUpStart ? !waveDissipated : !maximumWave;
                shouldRenderNextFrame = shouldRenderNextFrame || shouldRenderWaveAgain;
                if (!shouldKeepWave || this.cancelled) {
                    deleteTheseWaves.push(wave)
                }
            }
            if (shouldRenderNextFrame) {
                requestAnimationFrame(this._loop)
            }
            for (var i = 0; i < deleteTheseWaves.length; ++i) {
                var wave = deleteTheseWaves[i];
                removeWaveFromScope(this, wave)
            }
            if (!this.waves.length && this._loop) {
                this.$.bg.style.backgroundColor = null ;
                this._loop = null ;
                this.fire("core-transitionend")
            }
        }
    })
}
)();
(function() {
    var p = {
        eventDelegates: {
            down: "downAction",
            up: "upAction"
        },
        toggleBackground: function() {
            if (this.active) {
                if (!this.$.bg) {
                    var bg = document.createElement("div");
                    bg.setAttribute("id", "bg");
                    bg.setAttribute("fit", "");
                    bg.style.opacity = .25;
                    this.$.bg = bg;
                    this.shadowRoot.insertBefore(bg, this.shadowRoot.firstChild)
                }
                this.$.bg.style.backgroundColor = getComputedStyle(this).color
            } else {
                if (this.$.bg) {
                    this.$.bg.style.backgroundColor = ""
                }
            }
        },
        activeChanged: function() {
            this.super();
            if (this.toggle && (!this.lastEvent || this.matches(":host-context([noink])"))) {
                this.toggleBackground()
            }
            if (this.active) {
                if (!this.lastEvent) {
                    var rect = this.getBoundingClientRect();
                    this.lastEvent = {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    }
                }
                this.ensureRippleExist();
                this.$.ripple.downAction(this.lastEvent)
            } else {
                if (this.$.ripple) {
                    this.$.ripple.upAction()
                }
            }
        },
        pressedChanged: function() {
            this.super();
            if (!this.lastEvent) {
                return
            }
            if (this.$.ripple && !this.hasAttribute("noink")) {
                if (this.pressed) {
                    this.$.ripple.downAction(this.lastEvent)
                } else {
                    this.$.ripple.upAction()
                }
            }
            this.adjustZ()
        },
        focusedChanged: function() {
            this.adjustZ()
        },
        disabledChanged: function() {
            this._disabledChanged();
            this.adjustZ()
        },
        recenteringTouchChanged: function() {
            if (this.$.ripple) {
                this.$.ripple.classList.toggle("recenteringTouch", this.recenteringTouch)
            }
        },
        fillChanged: function() {
            if (this.$.ripple) {
                this.$.ripple.classList.toggle("fill", this.fill)
            }
        },
        adjustZ: function() {
            if (!this.$.shadow) {
                return
            }
            if (this.active) {
                this.$.shadow.setZ(2)
            } else if (this.disabled) {
                this.$.shadow.setZ(0)
            } else if (this.focused) {
                this.$.shadow.setZ(3)
            } else {
                this.$.shadow.setZ(1)
            }
        },
        downAction: function(e) {
            this._downAction();
            if (this.hasAttribute("noink")) {
                return
            }
            this.lastEvent = e;
            this.ensureRippleExist()
        },
        ensureRippleExist: function() {
            if (this.$.ripple) {
                return
            }
            var ripple = document.createElement("paper-ripple");
            ripple.setAttribute("id", "ripple");
            ripple.setAttribute("fit", "");
            if (this.recenteringTouch) {
                ripple.classList.add("recenteringTouch")
            }
            if (!this.fill) {
                ripple.classList.add("circle")
            }
            this.$.ripple = ripple;
            this.shadowRoot.insertBefore(ripple, this.shadowRoot.firstChild)
        },
        upAction: function() {
            this._upAction();
            if (this.toggle) {
                this.toggleBackground();
                if (this.$.ripple) {
                    this.$.ripple.cancel()
                }
            }
        }
    };
    Polymer.mixin2(p, Polymer.CoreFocusable);
    Polymer("paper-button-base", p)
}
)();
Polymer("paper-icon-button", {
    publish: {
        src: "",
        icon: "",
        recenteringTouch: true,
        fill: false
    },
    iconChanged: function(oldIcon) {
        var label = this.getAttribute("aria-label");
        if (!label || label === oldIcon) {
            this.setAttribute("aria-label", this.icon)
        }
    }
});
Polymer("topsite-card", {
    keypressHandler: function(event) {
        if (event.keyCode == 13 || event.keyCode == 32) {
            event.stopPropagation();
            this.openUrl()
        }
    },
    publish: {
        site: "http://www.google.com",
        setVisible: function(opt_toVisible) {
            this.style.transform = "scale(" + (opt_toVisible == false ? 0 : 1) + ")"
        }
    },
    openUrl: function() {
        window.location = this.site
    }
});
Polymer("topsites-list", {
    maxSites: 9,
    publish: {
        list: [],
        delayFactor: 1.5,
        delayOffsetMs: 100,
        setVisible: function(opt_toVisible) {
            var cards = [];
            for (var i = 0; i < this.maxSites && i < this.list.length; i++) {
                var topsiteCard = this.$.container.querySelector("#topsite" + i);
                cards.push(topsiteCard);
                var delay = 0;
                if (opt_toVisible) {
                    var ratio = topsiteCard.offsetWidth / topsiteCard.offsetHeight;
                    var offset = topsiteCard.offsetLeft + topsiteCard.offsetTop * ratio;
                    var delay = this.delayOffsetMs + offset / this.delayFactor
                }
                topsiteCard.style.transitionDelay = delay + "ms"
            }
            for (var i = 0, card; card = cards[i]; i++) {
                card.setVisible(opt_toVisible)
            }
            opt_toVisible && cards[0] && cards[0].focus()
        }
    }
});
Polymer("rotating-button", {
    publish: {
        src: "",
        icon: "",
        recenteringTouch: true,
        fill: false
    },
    iconChanged: function(oldIcon) {
        var label = this.getAttribute("aria-label");
        if (!label || label === oldIcon) {
            this.setAttribute("aria-label", this.icon)
        }
    }
});
var g = this
  , k = function() {}
  , m = function(a) {
    var b = typeof a;
    if ("object" == b)
        if (a) {
            if (a instanceof Array)
                return "array";
            if (a instanceof Object)
                return b;
            var c = Object.prototype.toString.call(a);
            if ("[object Window]" == c)
                return "object";
            if ("[object Array]" == c || "number" == typeof a.length && "undefined" != typeof a.splice && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("splice"))
                return "array";
            if ("[object Function]" == c || "undefined" != typeof a.call && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("call"))
                return "function"
        } else
            return "null";
    else if ("function" == b && "undefined" == typeof a.call)
        return "object";
    return b
}
  , n = function(a) {
    return "function" == m(a)
}
  , aa = function(a, b, c) {
    return a.call.apply(a.bind, arguments)
}
  , ba = function(a, b, c) {
    if (!a)
        throw Error();
    if (2 < arguments.length) {
        var d = Array.prototype.slice.call(arguments, 2);
        return function() {
            var c = Array.prototype.slice.call(arguments);
            Array.prototype.unshift.apply(c, d);
            return a.apply(b, c)
        }
    }
    return function() {
        return a.apply(b, arguments)
    }
}
  , p = function(a, b, c) {
    p = Function.prototype.bind && -1 != Function.prototype.bind.toString().indexOf("native code") ? aa : ba;
    return p.apply(null , arguments)
}
  , q = function(a, b) {
    function c() {}
    c.prototype = b.prototype;
    a.ua = b.prototype;
    a.prototype = new c;
    a.wa = function(a, c, f) {
        for (var h = Array(arguments.length - 2), l = 2; l < arguments.length; l++)
            h[l - 2] = arguments[l];
        return b.prototype[c].apply(a, h)
    }
}
;
Function.prototype.bind = Function.prototype.bind || function(a, b) {
    if (1 < arguments.length) {
        var c = Array.prototype.slice.call(arguments, 1);
        c.unshift(this, a);
        return p.apply(null , c)
    }
    return p(this, a)
}
;
var r = function(a) {
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, r);
    else {
        var b = Error().stack;
        b && (this.stack = b)
    }
    a && (this.message = String(a))
}
;
q(r, Error);
var ca = function(a, b) {
    for (var c = a.split("%s"), d = "", e = Array.prototype.slice.call(arguments, 1); e.length && 1 < c.length; )
        d += c.shift() + e.shift();
    return d + c.join("%s")
}
  , t = function(a) {
    return null  == a ? "" : String(a)
}
;
var u = function(a, b) {
    b.unshift(a);
    r.call(this, ca.apply(null , b));
    b.shift()
}
;
q(u, r);
var v = function(a, b, c, d) {
    var e = "Assertion failed";
    if (c)
        var e = e + (": " + c)
          , f = d;
    else
        a && (e += ": " + a,
        f = b);
    throw new u("" + e,f || [])
}
  , w = function(a, b, c) {
    a || v("", null , b, Array.prototype.slice.call(arguments, 2));
    return a
}
  , x = function(a, b, c) {
    n(a) || v("Expected function but got %s: %s.", [m(a), a], b, Array.prototype.slice.call(arguments, 2))
}
;
var da = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ")
  , ea = function(a, b) {
    for (var c, d, e = 1; e < arguments.length; e++) {
        d = arguments[e];
        for (c in d)
            a[c] = d[c];
        for (var f = 0; f < da.length; f++)
            c = da[f],
            Object.prototype.hasOwnProperty.call(d, c) && (a[c] = d[c])
    }
}
;
var fa = Array.prototype
  , ga = fa.some ? function(a, b, c) {
    w(null  != a.length);
    return fa.some.call(a, b, c)
}
 : function(a, b, c) {
    for (var d = a.length, e = "string" == typeof a ? a.split("") : a, f = 0; f < d; f++)
        if (f in e && b.call(c, e[f], f, a))
            return !0;
    return !1
}
;
var y;
a: {
    var ha = g.navigator;
    if (ha) {
        var ia = ha.userAgent;
        if (ia) {
            y = ia;
            break a
        }
    }
    y = ""
}
var z = function(a) {
    return -1 != y.indexOf(a)
}
;
var ja = function() {
    return z("Edge") || z("Trident") || z("MSIE")
}
;
var ka = z("Opera") || z("OPR")
  , A = ja()
  , la = z("Gecko") && !(-1 != y.toLowerCase().indexOf("webkit") && !z("Edge")) && !(z("Trident") || z("MSIE")) && !z("Edge")
  , ma = -1 != y.toLowerCase().indexOf("webkit") && !z("Edge")
  , na = function() {
    var a = y;
    if (la)
        return /rv\:([^\);]+)(\)|;)/.exec(a);
    if (A && z("Edge"))
        return /Edge\/([\d\.]+)/.exec(a);
    if (A)
        return /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);
    if (ma)
        return /WebKit\/(\S+)/.exec(a)
}
;
(function() {
    if (ka && g.opera) {
        var a = g.opera.version;
        return n(a) ? a() : a
    }
    var a = ""
      , b = na();
    b && (a = b ? b[1] : "");
    return A && !z("Edge") && (b = (b = g.document) ? b.documentMode : void 0,
    b > parseFloat(a)) ? String(b) : a
}
)();
var B = function(a, b, c) {
    this.sa = c;
    this.oa = a;
    this.ta = b;
    this.N = 0;
    this.L = null 
}
;
B.prototype.get = function() {
    var a;
    0 < this.N ? (this.N--,
    a = this.L,
    this.L = a.next,
    a.next = null ) : a = this.oa();
    return a
}
;
B.prototype.put = function(a) {
    this.ta(a);
    this.N < this.sa && (this.N++,
    a.next = this.L,
    this.L = a)
}
;
var oa = function(a) {
    g.setTimeout(function() {
        throw a
    }
    , 0)
}
, C, pa = function() {
    var a = g.MessageChannel;
    "undefined" === typeof a && "undefined" !== typeof window && window.postMessage && window.addEventListener && !z("Presto") && (a = function() {
        var a = document.createElement("IFRAME");
        a.style.display = "none";
        a.src = "";
        document.documentElement.appendChild(a);
        var b = a.contentWindow
          , a = b.document;
        a.open();
        a.write("");
        a.close();
        var c = "callImmediate" + Math.random()
          , d = "file:" == b.location.protocol ? "*" : b.location.protocol + "//" + b.location.host
          , a = p(function(a) {
            if (("*" == d || a.origin == d) && a.data == c)
                this.port1.onmessage()
        }
        , this);
        b.addEventListener("message", a, !1);
        this.port1 = {};
        this.port2 = {
            postMessage: function() {
                b.postMessage(c, d)
            }
        }
    }
    );
    if ("undefined" !== typeof a && !ja()) {
        var b = new a
          , c = {}
          , d = c;
        b.port1.onmessage = function() {
            if (void 0 !== c.next) {
                c = c.next;
                var a = c.ca;
                c.ca = null ;
                a()
            }
        }
        ;
        return function(a) {
            d.next = {
                ca: a
            };
            d = d.next;
            b.port2.postMessage(0)
        }
    }
    return "undefined" !== typeof document && "onreadystatechange" in document.createElement("SCRIPT") ? function(a) {
        var b = document.createElement("SCRIPT");
        b.onreadystatechange = function() {
            b.onreadystatechange = null ;
            b.parentNode.removeChild(b);
            b = null ;
            a();
            a = null 
        }
        ;
        document.documentElement.appendChild(b)
    }
     : function(a) {
        g.setTimeout(a, 0)
    }
}
;
var D = function() {
    this.S = this.s = null 
}
  , qa = new B(function() {
    return new E
}
,function(a) {
    a.reset()
}
,100);
D.prototype.add = function(a, b) {
    var c = qa.get();
    c.set(a, b);
    this.S ? this.S.next = c : (w(!this.s),
    this.s = c);
    this.S = c
}
;
D.prototype.remove = function() {
    var a = null ;
    this.s && (a = this.s,
    this.s = this.s.next,
    this.s || (this.S = null ),
    a.next = null );
    return a
}
;
var E = function() {
    this.next = this.scope = this.Y = null 
}
;
E.prototype.set = function(a, b) {
    this.Y = a;
    this.scope = b;
    this.next = null 
}
;
E.prototype.reset = function() {
    this.next = this.scope = this.Y = null 
}
;
var H = function(a, b) {
    F || ra();
    G || (F(),
    G = !0);
    sa.add(a, b)
}
, F, ra = function() {
    if (g.Promise && g.Promise.resolve) {
        var a = g.Promise.resolve();
        F = function() {
            a.then(ta)
        }
    } else
        F = function() {
            var a = ta;
            !n(g.setImmediate) || g.Window && g.Window.prototype && g.Window.prototype.setImmediate == g.setImmediate ? (C || (C = pa()),
            C(a)) : g.setImmediate(a)
        }
}
, G = !1, sa = new D, ta = function() {
    for (var a = null ; a = sa.remove(); ) {
        try {
            a.Y.call(a.scope)
        } catch (b) {
            oa(b)
        }
        qa.put(a)
    }
    G = !1
}
;
var ua = function(a) {
    a.prototype.then = a.prototype.then;
    a.prototype.$goog_Thenable = !0
}
  , va = function(a) {
    if (!a)
        return !1;
    try {
        return !!a.$goog_Thenable
    } catch (b) {
        return !1
    }
}
;
var K = function(a, b) {
    this.b = 0;
    this.g = void 0;
    this.u = this.f = this.a = null ;
    this.K = this.X = !1;
    if (a == wa)
        I(this, 2, b);
    else
        try {
            var c = this;
            a.call(b, function(a) {
                I(c, 2, a)
            }
            , function(a) {
                if (!(a instanceof J))
                    try {
                        if (a instanceof Error)
                            throw a;
                        throw Error("Promise rejected.")
                    } catch (b) {}
                I(c, 3, a)
            }
            )
        } catch (d) {
            I(this, 3, d)
        }
}
  , xa = function() {
    this.next = this.context = this.v = this.m = this.i = null ;
    this.G = !1
}
;
xa.prototype.reset = function() {
    this.context = this.v = this.m = this.i = null ;
    this.G = !1
}
;
var ya = new B(function() {
    return new xa
}
,function(a) {
    a.reset()
}
,100)
  , za = function(a, b, c) {
    var d = ya.get();
    d.m = a;
    d.v = b;
    d.context = c;
    return d
}
  , wa = function() {}
;
K.prototype.then = function(a, b, c) {
    null  != a && x(a, "opt_onFulfilled should be a function.");
    null  != b && x(b, "opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");
    return Aa(this, n(a) ? a : null , n(b) ? b : null , c)
}
;
ua(K);
K.prototype.cancel = function(a) {
    0 == this.b && H(function() {
        var b = new J(a);
        Ba(this, b)
    }
    , this)
}
;
var Ba = function(a, b) {
    if (0 == a.b)
        if (a.a) {
            var c = a.a;
            if (c.f) {
                for (var d = 0, e = null , f = null , h = c.f; h && (h.G || (d++,
                h.i == a && (e = h),
                !(e && 1 < d))); h = h.next)
                    e || (f = h);
                e && (0 == c.b && 1 == d ? Ba(c, b) : (f ? (d = f,
                w(c.f),
                w(null  != d),
                d.next == c.u && (c.u = d),
                d.next = d.next.next) : Ca(c),
                Da(c, e, 3, b)))
            }
            a.a = null 
        } else
            I(a, 3, b)
}
  , Fa = function(a, b) {
    a.f || 2 != a.b && 3 != a.b || Ea(a);
    w(null  != b.m);
    a.u ? a.u.next = b : a.f = b;
    a.u = b
}
  , Aa = function(a, b, c, d) {
    var e = za(null , null , null );
    e.i = new K(function(a, h) {
        e.m = b ? function(c) {
            try {
                var e = b.call(d, c);
                a(e)
            } catch (P) {
                h(P)
            }
        }
         : a;
        e.v = c ? function(b) {
            try {
                var e = c.call(d, b);
                void 0 === e && b instanceof J ? h(b) : a(e)
            } catch (P) {
                h(P)
            }
        }
         : h
    }
    );
    e.i.a = a;
    Fa(a, e);
    return e.i
}
;
K.prototype.la = function(a) {
    w(1 == this.b);
    this.b = 0;
    I(this, 2, a)
}
;
K.prototype.ma = function(a) {
    w(1 == this.b);
    this.b = 0;
    I(this, 3, a)
}
;
var I = function(a, b, c) {
    if (0 == a.b) {
        if (a == c)
            b = 3,
            c = new TypeError("Promise cannot resolve to itself");
        else {
            if (va(c)) {
                a.b = 1;
                b = c;
                c = a.la;
                var d = a.ma;
                b instanceof K ? (null  != c && x(c, "opt_onFulfilled should be a function."),
                null  != d && x(d, "opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),
                Fa(b, za(c || k, d || null , a))) : b.then(c, d, a);
                return
            }
            d = typeof c;
            if ("object" == d && null  != c || "function" == d)
                try {
                    var e = c.then;
                    if (n(e)) {
                        Ga(a, c, e);
                        return
                    }
                } catch (f) {
                    b = 3,
                    c = f
                }
        }
        a.g = c;
        a.b = b;
        a.a = null ;
        Ea(a);
        3 != b || c instanceof J || Ha(a, c)
    }
}
  , Ga = function(a, b, c) {
    a.b = 1;
    var d = !1
      , e = function(b) {
        d || (d = !0,
        a.la(b))
    }
      , f = function(b) {
        d || (d = !0,
        a.ma(b))
    }
    ;
    try {
        c.call(b, e, f)
    } catch (h) {
        f(h)
    }
}
  , Ea = function(a) {
    a.X || (a.X = !0,
    H(a.qa, a))
}
  , Ca = function(a) {
    var b = null ;
    a.f && (b = a.f,
    a.f = b.next,
    b.next = null );
    a.f || (a.u = null );
    null  != b && w(null  != b.m);
    return b
}
;
K.prototype.qa = function() {
    for (var a = null ; a = Ca(this); )
        Da(this, a, this.b, this.g);
    this.X = !1
}
;
var Da = function(a, b, c, d) {
    if (3 == c && b.v && !b.G)
        for (; a && a.K; a = a.a)
            a.K = !1;
    if (b.i)
        b.i.a = null ,
        Ia(b, c, d);
    else
        try {
            b.G ? b.m.call(b.context) : Ia(b, c, d)
        } catch (e) {
            Ja.call(null , e)
        }
    ya.put(b)
}
  , Ia = function(a, b, c) {
    2 == b ? a.m.call(a.context, c) : a.v && a.v.call(a.context, c)
}
  , Ha = function(a, b) {
    a.K = !0;
    H(function() {
        a.K && Ja.call(null , b)
    }
    )
}
  , Ja = oa
  , J = function(a) {
    r.call(this, a)
}
;
q(J, r);
var L = function(a, b) {
    this.P = [];
    this.ka = a;
    this.ea = b || null ;
    this.D = this.j = !1;
    this.g = void 0;
    this.$ = this.ba = this.T = !1;
    this.R = 0;
    this.a = null ;
    this.U = 0
}
;
L.prototype.cancel = function(a) {
    if (this.j)
        this.g instanceof L && this.g.cancel();
    else {
        if (this.a) {
            var b = this.a;
            delete this.a;
            a ? b.cancel(a) : (b.U--,
            0 >= b.U && b.cancel())
        }
        this.ka ? this.ka.call(this.ea, this) : this.$ = !0;
        this.j || this.B(new M)
    }
}
;
L.prototype.da = function(a, b) {
    this.T = !1;
    N(this, a, b)
}
;
var N = function(a, b, c) {
    a.j = !0;
    a.g = c;
    a.D = !b;
    Ka(a)
}
  , La = function(a) {
    if (a.j) {
        if (!a.$)
            throw new O;
        a.$ = !1
    }
}
  , Q = function(a, b) {
    La(a);
    Ma(b);
    N(a, !0, b)
}
;
L.prototype.B = function(a) {
    La(this);
    Ma(a);
    N(this, !1, a)
}
;
var Ma = function(a) {
    w(!(a instanceof L), "An execution sequence may not be initiated with a blocking Deferred.")
}
  , S = function(a, b, c) {
    return R(a, b, null , c)
}
  , R = function(a, b, c, d) {
    w(!a.ba, "Blocking Deferreds can not be re-used");
    a.P.push([b, c, d]);
    a.j && Ka(a);
    return a
}
;
L.prototype.then = function(a, b, c) {
    var d, e, f = new K(function(a, b) {
        d = a;
        e = b
    }
    );
    R(this, d, function(a) {
        a instanceof M ? f.cancel() : e(a)
    }
    );
    return f.then(a, b, c)
}
;
ua(L);
var Na = function(a) {
    return ga(a.P, function(a) {
        return n(a[1])
    }
    )
}
  , Ka = function(a) {
    if (a.R && a.j && Na(a)) {
        var b = a.R
          , c = T[b];
        c && (g.clearTimeout(c.F),
        delete T[b]);
        a.R = 0
    }
    a.a && (a.a.U--,
    delete a.a);
    for (var b = a.g, d = c = !1; a.P.length && !a.T; ) {
        var e = a.P.shift()
          , f = e[0]
          , h = e[1]
          , e = e[2];
        if (f = a.D ? h : f)
            try {
                var l = f.call(e || a.ea, b);
                void 0 !== l && (a.D = a.D && (l == b || l instanceof Error),
                a.g = b = l);
                if (va(b) || "function" === typeof g.Promise && b instanceof g.Promise)
                    d = !0,
                    a.T = !0
            } catch (Ra) {
                b = Ra,
                a.D = !0,
                Na(a) || (c = !0)
            }
    }
    a.g = b;
    d && (l = p(a.da, a, !0),
    d = p(a.da, a, !1),
    b instanceof L ? (R(b, l, d),
    b.ba = !0) : b.then(l, d));
    c && (b = new Oa(b),
    T[b.F] = b,
    a.R = b.F)
}
  , O = function() {
    r.call(this)
}
;
q(O, r);
O.prototype.message = "Deferred has already fired";
var M = function() {
    r.call(this)
}
;
q(M, r);
M.prototype.message = "Deferred was canceled";
var Oa = function(a) {
    this.F = g.setTimeout(p(this.va, this), 0);
    this.pa = a
}
;
Oa.prototype.va = function() {
    w(T[this.F], "Cannot throw an error that is not scheduled.");
    delete T[this.F];
    throw this.pa
}
;
var T = {};
var U = function(a, b, c, d, e, f) {
    L.call(this, e, f);
    this.Z = a;
    this.W = [];
    this.fa = !!b;
    this.ra = !!c;
    this.na = !!d;
    for (b = this.ja = 0; b < a.length; b++)
        R(a[b], p(this.ga, this, b, !0), p(this.ga, this, b, !1));
    0 != a.length || this.fa || Q(this, this.W)
}
;
q(U, L);
U.prototype.ga = function(a, b, c) {
    this.ja++;
    this.W[a] = [b, c];
    this.j || (this.fa && b ? Q(this, [a, c]) : this.ra && !b ? this.B(c) : this.ja == this.Z.length && Q(this, this.W));
    this.na && !b && (c = null );
    return c
}
;
U.prototype.B = function(a) {
    U.ua.B.call(this, a);
    for (a = 0; a < this.Z.length; a++)
        this.Z[a].cancel()
}
;
var Pa = function(a) {
    return S(new U(a,!1,!0), function(a) {
        for (var c = [], d = 0; d < a.length; d++)
            c[d] = a[d][1];
        return c
    }
    )
}
;
var Qa = function(a, b) {
    var c = new FileReader;
    c.onloadend = function() {
        c.result && b(c.result)
    }
    ;
    var d = new XMLHttpRequest;
    d.open("GET", a + "=s1200-rw");
    d.responseType = "blob";
    d.onload = function() {
        4 == d.readyState && c.readAsDataURL(w(d.response))
    }
    ;
    d.send()
}
  , Sa = function(a) {
    var b = new XMLHttpRequest;
    b.onreadystatechange = function() {
        if (4 == b.readyState) {
            var c = JSON.parse(b.responseText);
            a(c)
        }
    }
    ;
    b.open("GET", "https://www.gstatic.com/culturalinstitute/tabext/imax.json");
    try {
        b.send()
    } catch (c) {
        console.log("Something went wrong. Couldn't load asset data.")
    }
}
  , Ta = function(a) {
    if (!a)
        return !1;
    var b = function(a) {
        a = new Date(a);
        a.setHours(0, 0, 0, 0);
        return a.getTime()
    }
    ;
    return b(a) == b(Date.now())
}
  , Ua = {
    showAppsButton: !1,
    showDefaultTabLink: !1,
    showTopSitesButton: !0,
    turnoverModeDaily: !0
}
  , Va = function(a) {
    chrome.storage.sync.get("settings", function(b) {
        var c = {
            settings: Ua
        };
        ea(c, b);
        a(c.settings)
    }
    )
}
  , V = function(a) {
    if (!a)
        return "";
    "http" != a.substr(0, 4) && (a = "https://www.google.com/culturalinstitute/" + a);
    0 == a.indexOf("https://www.google.com/culturalinstitute/") && (a = a + (0 < a.indexOf("?") ? "&" : "?") + "utm_source=chrome_extension&utm_medium=default_link&utm_campaign=chrome_extension_1");
    return a
}
  , Wa = function() {
    for (var a = document.querySelectorAll("[data-msg]"), b = 0, c; c = a[b]; b++)
        c.innerHTML = chrome.i18n.getMessage(c.getAttribute("data-msg"))
}
;
var Xa, Ya = function() {
    if (!window._gaq) {
        window.GoogleAnalyticsObject = "_gaq";
        window._gaq = function() {
            window._gaq.q = window._gaq.q || [];
            window._gaq.q.push(arguments)
        }
        ;
        window._gaq.l = window._gaq.l || 1 * new Date;
        var a = window._gaq;
        a("create", "UA-29069524-7", "auto");
        a("set", "checkProtocolTask", function() {}
        )
    }
}
, $a = function() {
    if (!Xa) {
        var a = document.createElement("script");
        a.async = 1;
        a.src = "https://www.google-analytics.com/analytics.js";
        document.body.appendChild(a);
        window.addEventListener("unload", function() {
            W("Extension", "Leave")
        }
        );
        chrome.storage.local.get("gaNewInstallTracked", function(a) {
            a.gaNewInstallTracked || (W("Extension", "Install"),
            chrome.storage.local.set({
                gaNewInstallTracked: !0
            }))
        }
        );
        Za();
        Xa = !0
    }
}
, Za = function() {
    document.body.addEventListener("click", function(a) {
        var b = a.target.getAttribute("data-gacategory");
        a = a.target.getAttribute("data-gaaction");
        b && a && W(b, a)
    }
    )
}
, W = function(a, b) {
    var c = window._gaq || null ;
    c && c("send", "event", a, b, void 0)
}
, X = function(a, b, c, d) {
    b = (new Date).getTime() - b;
    var e = window._gaq || null ;
    e && e("send", "timing", a, c, b, d)
}
;
var ab = function() {
    this.I = new L;
    this.h = this.c = this.ia = null ;
    this.aa = !0;
    this.C = 0;
    this.o = this.M = this.H = this.V = this.w = null ;
    this.O = Date.now();
    this.J = this.A = ""
}
  , cb = function(a) {
    var b = p(function() {
        bb(this, "chrome-search://local-ntp/local-ntp.html")
    }
    , a)
      , c = p(function() {
        bb(this, "chrome://apps")
    }
    , a);
    a.o.addEventListener("click", p(function() {
        Y(this)
    }
    , a));
    document.getElementById("back").addEventListener("click", p(function() {
        Y(this)
    }
    , a));
    document.getElementById("shield").addEventListener("click", p(function() {
        Y(this)
    }
    , a));
    a.V.addEventListener("click", p(function(a) {
        if (navigator.onLine) {
            var b = w(this.O);
            X("TimeOnAsset", b, this.A, this.J);
            this.O = Date.now();
            this.ha(a.shiftKey ? -1 : 1)
        }
    }
    , a));
    a.H.addEventListener("click", c);
    a.M.addEventListener("click", b);
    for (var b = document.querySelectorAll("paper-icon-button, rotating-button"), c = 0, d; d = b[c]; c++)
        d.addEventListener("keypress", p(function(a) {
            if (32 == a.keyCode || 13 == a.keyCode)
                a.stopPropagation(),
                a.target.click(a)
        }
        , a));
    document.addEventListener("keyup", p(function(a) {
        document.body.classList.add("visible-focus");
        27 == a.keyCode && this.c.selected && Y(this)
    }
    , a));
    document.addEventListener("focus", p(function(a) {
        var b = document.getElementById("topSites");
        this.c.selected && !b.contains(a.target) && (a.stopPropagation(),
        b.focus())
    }
    , a), !0);
    document.addEventListener("mouseup", p(function() {
        document.body.classList.remove("visible-focus")
    }
    , a));
    b = p(function() {
        document.body.classList.remove("nochrome");
        window.clearTimeout(this.ia)
    }
    , a);
    document.body.addEventListener("mouseover", b);
    window.onfocus = b;
    document.body.addEventListener("mouseout", p(function() {
        this.ia = window.setTimeout(function() {
            document.body.classList.add("nochrome")
        }
        , 1e3)
    }
    , a))
}
  , db = function(a, b, c) {
    a.w.innerHTML = "#main { background-image: url(" + c + "); }";
    c = document.getElementById("title");
    var d = document.getElementById("creator")
      , e = document.getElementById("partner");
    c.innerText = b.title || chrome.i18n.getMessage("untitled");
    c.href = V(b.link);
    d.innerText = b.creator || chrome.i18n.getMessage("unknown");
    d.href = V(b.artist_link);
    e.innerText = b.attribution || "";
    e.href = V(b.attribution_link);
    document.getElementById("main").classList.remove("loading");
    X("RenderTime", a.O, a.A ? "refresh" : "initial");
    a.A = b.link.replace("asset-viewer/", "");
    a.J = c.innerText || "";
    if (b = window._gaq || null )
        c = "/artwork/" + a.A,
        b("send", "pageview", {
            page: c,
            title: a.J
        }),
        b("set", "page", c);
    $a()
}
  , eb = function(a, b) {
    var c = new L;
    chrome.storage.sync.get("lastId", p(function(a) {
        if (void 0 !== a.lastId) {
            var e = a.lastId;
            if (navigator.onLine) {
                var f = p(function(a) {
                    Q(c, a);
                    var b = {};
                    b.lastId = {
                        id: a,
                        timestamp: Date.now()
                    };
                    chrome.storage.sync.set(b, k);
                    b = {};
                    b.updateTab = a;
                    chrome.runtime.sendMessage(b)
                }
                , this);
                !b && this.aa ? (a = {},
                a.newTab = e.id,
                chrome.runtime.sendMessage(a, p(function(a) {
                    "number" == typeof a ? Q(c, a) : Z(this, e.id, f)
                }
                , this))) : b || !Ta(e.timestamp) ? Z(this, e.id, f, b) : Q(c, e.id)
            } else
                Q(c, e.id)
        } else
            c.B(),
            console.log("Asset Id not found, user data not initialized ?")
    }
    , a));
    return c
}
  , fb = function(a) {
    var b = new L;
    chrome.storage.local.get(["currentAsset", "nextAsset"], p(function(a) {
        Q(b, a)
    }
    , a));
    return b
}
;
ab.prototype.ha = function(a) {
    0 < this.C || (gb(this),
    S(Pa([eb(this, a), fb(this)]), function(a) {
        var c = a[0];
        a = a[1];
        var d = a.nextAsset && a.nextAsset.id || -1;
        d == c && (a.currentAsset = a.nextAsset,
        chrome.storage.local.set({
            xa: a.nextAsset
        }));
        a.currentAsset && a.currentAsset.id == c ? db(this, a.currentAsset.info, a.currentAsset.image) : S(this.I, function(a) {
            if (navigator.onLine) {
                var b = hb(a, c);
                a = b.image;
                this.C++;
                Qa(a, p(function(a) {
                    db(this, b, a);
                    chrome.storage.local.set({
                        currentAsset: {
                            id: c,
                            image: a,
                            info: b
                        }
                    });
                    this.C--
                }
                , this))
            } else
                console.log("Oh noes! Network *and* cache unavailable!")
        }
        , this);
        S(this.I, function(a) {
            Z(this, c, p(function(b) {
                if (navigator.onLine && d != b) {
                    var c = hb(a, b)
                      , l = c.image;
                    this.C++;
                    Qa(l, p(function(a) {
                        chrome.storage.local.set({
                            nextAsset: {
                                id: b,
                                image: a,
                                info: c
                            }
                        });
                        this.C--
                    }
                    , this))
                }
            }
            , this))
        }
        , this)
    }
    , this))
}
;
var hb = function(a, b) {
    var c = a.length - 1;
    return a[b > c ? c : b]
}
  , Y = function(a) {
    if (a.c && a.o && !a.o.style.display) {
        !a.h.list.length && ib(a);
        var b = document.getElementById("shield")
          , c = p(function() {
            var a = p(function() {
                this.h && this.c.selected ? this.h.setVisible && this.h.setVisible(!0) : this.h.setVisible && this.h.setVisible(!1);
                this.c.removeEventListener("core-transitionend", a)
            }
            , this);
            this.c.addEventListener("core-transitionend", a);
            this.c.selected = Math.abs(this.c.selected - 1)
        }
        , a);
        if (0 == a.c.selected)
            window.setTimeout(c, 150),
            b.classList.remove("minified");
        else {
            var d = p(function() {
                b.classList.remove("fadeout");
                b.removeEventListener("webkitTransitionEnd", d);
                this.o.focus()
            }
            , a);
            b.addEventListener("webkitTransitionEnd", d, !1);
            b.classList.add("fadeout");
            b.classList.add("minified");
            c()
        }
    }
}
  , gb = function(a, b) {
    var c = document.getElementById("main");
    a.w.innerHTML && (document.body.style.backgroundColor = "black");
    b && (document.body.style.backgroundColor = "white");
    c.classList.add("loading")
}
  , bb = function(a, b) {
    gb(a, !0);
    window.setTimeout(function() {
        chrome.tabs.update({
            url: b
        })
    }
    , 100)
}
  , jb = function(a, b, c) {
    a = p(function(a) {
        this.aa = !!a.turnoverModeAlways;
        c && c();
        this.H.style.display = a.showAppsButton ? "" : "none";
        this.M.style.display = a.showDefaultTabLink ? "" : "none";
        this.o.style.display = a.showTopSitesButton ? "" : "none";
        a = [t(!!a.showAppsButton), t(!!a.showDefaultTabLink), t(!!a.showTopSitesButton), t(!!a.turnoverModeAlways)];
        var b = window._gaq || null ;
        if (b)
            for (var f = 0, h; h = a[f]; f++)
                b("set", "dimension" + (f + 1), h)
    }
    , a);
    b ? a(b) : Va(a)
}
  , Z = function(a, b, c, d) {
    S(a.I, function(a) {
        var f = d || 1
          , f = "number" == typeof b ? b + f : 0;
        c(f >= a.length ? 0 : 0 > f ? a.length - 1 : f)
    }
    , a)
}
  , ib = function(a) {
    chrome.topSites.get(p(function(a) {
        this.h.list = a
    }
    , a))
}
;
document.title = chrome.i18n.getMessage("pageTitle");
(function() {
    var a = new ab;
    Ya();
    a.o = document.getElementById("topsitesBtn");
    a.H = document.getElementById("applications");
    a.M = document.getElementById("defaultNewTab");
    a.V = document.getElementById("change");
    a.c = document.querySelector("core-animated-pages");
    a.h = document.querySelector("topsites-list");
    a.w = document.createElement("style");
    a.w.type = "text/css";
    document.getElementsByTagName("head")[0].appendChild(a.w);
    jb(a, void 0, p(a.ha, a));
    Sa(p(function(a) {
        Q(this.I, a)
    }
    , a));
    document.getElementById("credits").href += "?utm_source=chrome_extension&utm_medium=default_link&utm_campaign=chrome_extension_1";
    a.o.title = chrome.i18n.getMessage("topsites");
    a.H.title = chrome.i18n.getMessage("apps");
    a.M.title = chrome.i18n.getMessage("defaultNewTab");
    a.V.title = chrome.i18n.getMessage("change");
    document.getElementById("back").title = chrome.i18n.getMessage("close");
    Wa();
    cb(a);
    window.addEventListener("beforeunload", p(function() {
        var a = w(this.O);
        X("TimeOnAsset", a, this.A, this.J)
    }
    , a));
    chrome.runtime.onMessage.addListener(p(function(a) {
        a.settingsUpdate && jb(this, a.settingsUpdate)
    }
    , a))
}
)();
