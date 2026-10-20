"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRIPLE_TERM_NAMES = exports.QUAD_TERM_NAMES = void 0;
exports.isCompoundTerm = isCompoundTerm;
exports.getChildTerms = getChildTerms;
exports.matchSequence = matchSequence;
exports.getTerms = getTerms;
exports.getTermsNested = getTermsNested;
exports.getNamedTerms = getNamedTerms;
exports.collectNamedTerms = collectNamedTerms;
exports.forEachTerms = forEachTerms;
exports.forEachTermsNested = forEachTermsNested;
exports.filterTerms = filterTerms;
exports.filterTermsNested = filterTermsNested;
exports.filterQuadTermNames = filterQuadTermNames;
exports.filterQuadTermNamesNested = filterQuadTermNamesNested;
exports.mapTerms = mapTerms;
exports.mapTermsNested = mapTermsNested;
exports.reduceTerms = reduceTerms;
exports.reduceTermsNested = reduceTermsNested;
exports.everyTerms = everyTerms;
exports.everyTermsNested = everyTermsNested;
exports.someTerms = someTerms;
exports.someTermsNested = someTermsNested;
exports.getValueNestedPath = getValueNestedPath;
exports.matchTerm = matchTerm;
exports.matchPattern = matchPattern;
exports.matchPatternComplete = matchPatternComplete;
exports.matchPatternMappings = matchPatternMappings;
const rdf_data_factory_1 = require("rdf-data-factory");
const DF = new rdf_data_factory_1.DataFactory();
/**
 * All available quad term names.
 * @type {[string , string , string , string]}
 */
exports.QUAD_TERM_NAMES = ['subject', 'predicate', 'object', 'graph'];
/**
 * All available triple term names.
 * @type {[string , string , string]}
 */
exports.TRIPLE_TERM_NAMES = ['subject', 'predicate', 'object'];
/**
 * RDF-: check whether a term holds other terms (a quoted triple or a sequence).
 * @param {Term} term An RDFJS term.
 */
function isCompoundTerm(term) {
    return term.termType === 'Quad' || term.termType === 'Sequence';
}
/**
 * RDF-: the direct children of a quoted triple or a sequence, each with its key.
 * @param {CompoundTerm} term A quoted triple or a sequence.
 */
function getChildTerms(term) {
    return term.termType === 'Quad' ?
        exports.QUAD_TERM_NAMES.map((key) => [key, term[key]]) :
        term.elements.map((element, index) => [index, element]);
}
/**
 * RDF-: rebuild a quoted triple or a sequence from (mapped) children, in the order of {@link getChildTerms}.
 */
function buildCompoundTerm(term, children, dataFactory) {
    if (term.termType === 'Quad') {
        return dataFactory.quad(children[0], children[1], children[2], children[3]);
    }
    if (!dataFactory.sequence) {
        throw new Error(`Missing 'sequence()' method on the given DataFactory`);
    }
    return dataFactory.sequence(children);
}
/**
 * RDF-: a sequence matches a sequence pattern of the same length whose elements each match
 * (see {@link matchTerm}).
 * @param {Sequence} sequence A sequence (can not contain variables).
 * @param {Sequence} pattern A sequence pattern (can contain variables).
 */
function matchSequence(sequence, pattern) {
    return sequence.elements.length === pattern.elements.length &&
        pattern.elements.every((element, index) => matchTerm(sequence.elements[index], element));
}
/**
 * Get all terms in the given quad.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {boolean} ignoreDefaultGraph If true and the quad has the default graph as graph,
 *                                     this term will not be returned in the array.
 *                                     (default: false)
 * @return {Term[]} The available terms in the quad.
 */
function getTerms(quad, ignoreDefaultGraph) {
    if (ignoreDefaultGraph && quad.graph.termType === 'DefaultGraph') {
        return [quad.subject, quad.predicate, quad.object];
    }
    return [quad.subject, quad.predicate, quad.object, quad.graph];
}
/**
 * Get all terms in the given quad, including nested quads.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {boolean} ignoreDefaultGraph If true and the quad has the default graph as graph,
 *                                     this term will not be returned in the array.
 *                                     (default: false)
 * @return {Term[]} The available terms in the nested quad, excluding quad terms.
 */
function getTermsNested(quad, ignoreDefaultGraph) {
    const terms = [];
    for (const term of getTerms(quad, ignoreDefaultGraph)) {
        collectLeafTerms(term, terms, ignoreDefaultGraph);
    }
    return terms;
}
function collectLeafTerms(term, terms, ignoreDefaultGraph) {
    if (isCompoundTerm(term)) {
        for (const [key, child] of getChildTerms(term)) {
            if (!(ignoreDefaultGraph && key === 'graph' && child.termType === 'DefaultGraph')) {
                collectLeafTerms(child, terms, ignoreDefaultGraph);
            }
        }
    }
    else {
        terms.push(term);
    }
}
/**
 * Convert the given quad to an array of named terms.
 * This is the reverse operation of {@link collectNamedTerms}.
 * @param {BaseQuad} quad An RDFJS quad.
 * @return {INamedTerm[]} An array of named terms.
 */
function getNamedTerms(quad) {
    return [
        { key: 'subject', value: quad.subject },
        { key: 'predicate', value: quad.predicate },
        { key: 'object', value: quad.object },
        { key: 'graph', value: quad.graph },
    ];
}
/**
 * Convert an array of named terms to an RDFJS quad.
 * This is the reverse operation of {@link getNamedTerms}.
 * @param {INamedTerm[]} namedTerms An array of named terms.
 * @param {(termName: QuadTermName) => Term} defaultCb An optional callback for when
 *                                                     certain terms are not available in the array.
 * @param {RDF.DataFactory} dataFactory A custom data factory to create quads.
 * @return {Q} The resulting RDFJS quad.
 * @template Q The type of quad to output, defaults to RDF.Quad.
 */
function collectNamedTerms(namedTerms, defaultCb, dataFactory) {
    const elements = {};
    namedTerms.forEach((namedTerm) => elements[namedTerm.key] = namedTerm.value);
    if (defaultCb) {
        elements.subject = elements.subject || defaultCb('subject');
        elements.predicate = elements.predicate || defaultCb('predicate');
        elements.object = elements.object || defaultCb('object');
        elements.graph = elements.graph || defaultCb('graph');
    }
    return (dataFactory || DF).quad(elements.subject, elements.predicate, elements.object, elements.graph);
}
/**
 * Iterates over each term.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} cb A callback function.
 */
function forEachTerms(quad, cb) {
    cb(quad.subject, 'subject');
    cb(quad.predicate, 'predicate');
    cb(quad.object, 'object');
    cb(quad.graph, 'graph');
}
/**
 * Iterates over each leaf term, while recursing into quoted triples and (RDF-) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} cb A callback function.
 * @param QuadTermName[] keys The current key path.
 */
function forEachTermsNested(quad, cb, keys = []) {
    for (const [key, child] of getChildTerms(quad)) {
        const path = [...keys, key];
        if (isCompoundTerm(child)) {
            forEachTermsNested(child, cb, path);
        }
        else {
            cb(child, path);
        }
    }
}
/**
 * Get all terms in the given quad that return true on the given filter function.
 * @param {BaseQuad} quad A quad.
 * @param {(value: Term, key: QuadTermName) => boolean} filter A filter callback.
 * @return {Term[]} The list of matching terms.
 */
function filterTerms(quad, filter) {
    const terms = [];
    if (filter(quad.subject, 'subject')) {
        terms.push(quad.subject);
    }
    if (filter(quad.predicate, 'predicate')) {
        terms.push(quad.predicate);
    }
    if (filter(quad.object, 'object')) {
        terms.push(quad.object);
    }
    if (filter(quad.graph, 'graph')) {
        terms.push(quad.graph);
    }
    return terms;
}
/**
 * Get all terms in the given quad that return true on the given filter function, while recursing into quoted triples and (RDF-) sequences.
 * @param {BaseQuad} quad A quad.
 * @param {(value: Term, key: QuadTermName) => boolean} filter A filter callback.
 * @param QuadTermName[] keys The current key path.
 * @return {Term[]} The list of matching terms.
 */
function filterTermsNested(quad, filter, keys = []) {
    const terms = [];
    forEachTermsNested(quad, (value, path) => {
        if (filter(value, path)) {
            terms.push(value);
        }
    }, keys);
    return terms;
}
/**
 * Get all quad term names in the given quad that return true on the given filter function.
 * @param {BaseQuad} quad A quad.
 * @param {(value: Term, key: QuadTermName, all: INamedTerm[]) => boolean} filter A filter callback.
 * @return {QuadTermName[]} The list of matching quad term names.
 */
function filterQuadTermNames(quad, filter) {
    const names = [];
    if (filter(quad.subject, 'subject')) {
        names.push('subject');
    }
    if (filter(quad.predicate, 'predicate')) {
        names.push('predicate');
    }
    if (filter(quad.object, 'object')) {
        names.push('object');
    }
    if (filter(quad.graph, 'graph')) {
        names.push('graph');
    }
    return names;
}
/**
 * Get all quad term names in the given quad that return true on the given filter function, while recursing into quoted triples and (RDF-) sequences.
 * @param {BaseQuad} quad A quad.
 * @param {(value: Term, key: QuadTermName, all: INamedTerm[]) => boolean} filter A filter callback.
 * @param QuadTermName[] keys The current key path.
 * @return {QuadTermName[]} The list of matching quad term names.
 */
function filterQuadTermNamesNested(quad, filter, keys = []) {
    const names = [];
    forEachTermsNested(quad, (value, path) => {
        if (filter(value, path)) {
            names.push(path);
        }
    }, keys);
    return names;
}
/**
 * Map all terms of a quad.
 * @param {Quad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName) => Term} mapper A mapper function.
 * @param {RDF.DataFactory} dataFactory A custom data factory to create quads.
 * @return {Quad} A new RDFJS quad.
 * @template Q The type of quad, defaults to RDF.Quad.
 */
function mapTerms(quad, mapper, dataFactory) {
    return (dataFactory || DF).quad(mapper(quad.subject, 'subject'), mapper(quad.predicate, 'predicate'), mapper(quad.object, 'object'), mapper(quad.graph, 'graph'));
}
/**
 * Map all terms of a quad, while recursing into quoted triples and (RDF-) sequences.
 * @param {Quad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName) => Term} mapper A mapper function.
 * @param {RDF.DataFactory} dataFactory A custom data factory to create quads.
 * @param QuadTermName[] keys The current key path.
 * @return {Quad} A new RDFJS quad.
 * @template Q The type of quad, defaults to RDF.Quad.
 */
function mapTermsNested(quad, mapper, dataFactory, keys = []) {
    return mapCompoundTerm(quad, mapper, dataFactory || DF, keys);
}
function mapCompoundTerm(term, mapper, dataFactory, keys) {
    return buildCompoundTerm(term, getChildTerms(term).map(([key, child]) => {
        const path = [...keys, key];
        return isCompoundTerm(child) ? mapCompoundTerm(child, mapper, dataFactory, path) : mapper(child, path);
    }), dataFactory);
}
/**
 * Reduce all terms of a quad.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(previousValue: U, currentValue: Term, key: QuadTermName) => U} reducer A reduce function.
 * @param {U} initialValue The initial value.
 * @return {U} The final value.
 */
function reduceTerms(quad, reducer, initialValue) {
    let value = initialValue;
    value = reducer(value, quad.subject, 'subject');
    value = reducer(value, quad.predicate, 'predicate');
    value = reducer(value, quad.object, 'object');
    return reducer(value, quad.graph, 'graph');
}
/**
 * Reduce all terms of a quad, while recursing into quoted triples and (RDF-) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(previousValue: U, currentValue: Term, key: QuadTermName) => U} reducer A reduce function.
 * @param {U} initialValue The initial value.
 * @param QuadTermName[] keys The current key path.
 * @return {U} The final value.
 */
function reduceTermsNested(quad, reducer, initialValue, keys = []) {
    let value = initialValue;
    forEachTermsNested(quad, (term, path) => {
        value = reducer(value, term, path);
    }, keys);
    return value;
}
/**
 * Determines whether all terms satisfy the specified test.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @return {boolean} If all terms satisfy the specified test.
 */
function everyTerms(quad, checker) {
    return checker(quad.subject, 'subject')
        && checker(quad.predicate, 'predicate')
        && checker(quad.object, 'object')
        && checker(quad.graph, 'graph');
}
/**
 * Determines whether all terms satisfy the specified test, while recursing into quoted triples and (RDF-) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @param QuadTermName[] keys The current key path.
 * @return {boolean} If all terms satisfy the specified test.
 */
function everyTermsNested(quad, checker, keys = []) {
    return getChildTerms(quad).every(([key, child]) => isCompoundTerm(child) ?
        everyTermsNested(child, checker, [...keys, key]) :
        checker(child, [...keys, key]));
}
/**
 * Determines whether at least one term satisfies the specified test.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @return {boolean} If at least one term satisfies the specified test.
 */
function someTerms(quad, checker) {
    return checker(quad.subject, 'subject')
        || checker(quad.predicate, 'predicate')
        || checker(quad.object, 'object')
        || checker(quad.graph, 'graph');
}
/**
 * Determines whether at least one term satisfies the specified test, while recursing into quoted triples and (RDF-) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @param QuadTermName[] keys The current key path.
 * @return {boolean} If at least one term satisfies the specified test.
 */
function someTermsNested(quad, checker, keys = []) {
    return getChildTerms(quad).some(([key, child]) => isCompoundTerm(child) ?
        someTermsNested(child, checker, [...keys, key]) :
        checker(child, [...keys, key]));
}
/**
 * Get the nested value inside a quoted triple or (RDF-) a sequence by the given path of keys.
 * @param term A term, that can be a quoted triple or a sequence.
 * @param keys A path of quad term names and sequence element indexes.
 */
function getValueNestedPath(term, keys) {
    if (keys.length === 0) {
        return term;
    }
    const [key, ...rest] = keys;
    if (term.termType === 'Quad' && typeof key === 'string') {
        return getValueNestedPath(term[key], rest);
    }
    if (term.termType === 'Sequence') {
        // RDF-: the key is the element index (possibly spelled as a string)
        const element = term.elements[Number(key)];
        if (element) {
            return getValueNestedPath(element, rest);
        }
        throw new Error(`Tried to get element ${key} from a sequence of ${term.elements.length} elements`);
    }
    throw new Error(`Tried to get ${key} from term of type ${term.termType}`);
}
/**
 * Check if the given terms match.
 *
 * At least one of the following must be true:
 * * Term B is undefined.
 * * Term B is a variable.
 * * Term A and B are quads, and return true for `matchPatternComplete`.
 * * (RDF-) Term A and B are sequences, and return true for `matchSequence`.
 * * Quad term and term are equal (`termB.equals(termA)` return true)
 *
 * @param termA A term.
 * @param termB An optional term.
 */
function matchTerm(termA, termB) {
    return !termB ||
        termB.termType === 'Variable' ||
        (termB.termType === 'Quad' && termA.termType === 'Quad' && matchPatternComplete(termA, termB)) ||
        (termB.termType === 'Sequence' && termA.termType === 'Sequence' && matchSequence(termA, termB)) ||
        termB.equals(termA);
}
/**
 * Check if the given quad matches with the given quad terms.
 *
 * Each term must match at least one of the following:
 * * Term is undefined.
 * * Term is a variable.
 * * Quad term and term are both quads, and return true for `matchPatternComplete`.
 * * Quad term and term are equal (`quadTerm.equals(term)` return true)
 *
 * @param {BaseQuad} quad A quad to match with (can not contain variables).
 * @param {Term} subject An optional subject.
 * @param {Term} predicate An optional predicate.
 * @param {Term} object An optional object.
 * @param {Term} graph An optional graph.
 * @return {boolean} If the quad matches with the quad terms.
 */
function matchPattern(quad, subject, predicate, object, graph) {
    return matchTerm(quad.subject, subject)
        && matchTerm(quad.predicate, predicate)
        && matchTerm(quad.object, object)
        && matchTerm(quad.graph, graph);
}
/**
 * Check if the first quad matches with all terms from the second quad.
 *
 * Each term must match at least one of the following:
 * * Quad2 term is a variable.
 * * Quad1 term and Quad2 term are equal (`term1.equals(term2)` return true)
 *
 * @param {BaseQuad} quad A quad (can not contain variables).
 * @param {BaseQuad} pattern A quad pattern (can contain variables).
 * @return {boolean} If the quad terms match.
 */
function matchPatternComplete(quad, pattern) {
    return matchPattern(quad, pattern.subject, pattern.predicate, pattern.object, pattern.graph);
}
function matchPatternMappings(quad, pattern, opt = {}) {
    const map = {};
    function matchTerms(t1, t2) {
        var _a, _b, _c;
        switch (t1.termType) {
            case 'Variable':
                return (((_a = opt.skipVarMapping) !== null && _a !== void 0 ? _a : false) && t2.termType === 'Variable') ||
                    ((_c = (_b = map[t1.value]) === null || _b === void 0 ? void 0 : _b.equals(t2)) !== null && _c !== void 0 ? _c : (map[t1.value] = t2, true));
            case 'Quad':
                return t2.termType === 'Quad' && match(t1, t2);
            case 'Sequence':
                // RDF-: element by element, variables inside the pattern's sequence included
                return t2.termType === 'Sequence' && t1.elements.length === t2.elements.length &&
                    t1.elements.every((element, index) => matchTerms(element, t2.elements[index]));
            default:
                return t1.equals(t2);
        }
    }
    function match(_pattern, _quad) {
        return everyTerms(_pattern, (t1, key) => matchTerms(t1, _quad[key]));
    }
    return match(pattern, quad) && (opt.returnMappings ? map : true);
}
//# sourceMappingURL=QuadTermUtil.js.map