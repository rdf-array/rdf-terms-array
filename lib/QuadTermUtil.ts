import { DataFactory } from "rdf-data-factory";
import * as RDF from "@rdfjs/types";

const DF = new DataFactory();

/*
 * Utility methods for handling terms in RDFJS quads.
 */

/**
 * The possible quad term entries in an RDFJS quad.
 */
export type QuadTermName = 'subject' | 'predicate' | 'object' | 'graph';

/**
 * All available quad term names.
 * @type {[string , string , string , string]}
 */
export const QUAD_TERM_NAMES: QuadTermName[] = ['subject', 'predicate', 'object', 'graph'];

/**
 * All available triple term names.
 * @type {[string , string , string]}
 */
export const TRIPLE_TERM_NAMES: QuadTermName[] = ['subject', 'predicate', 'object'];

/**
 * rdf-array: a step in a path into a nested term:
 * a quad term name inside a quoted triple, or an element index inside a sequence.
 */
export type NestedTermKey = QuadTermName | number;

/**
 * rdf-array: a term that holds other terms: a quoted triple or a sequence.
 */
export type CompoundTerm = RDF.BaseQuad | RDF.Sequence;

/**
 * rdf-array: check whether a term holds other terms (a quoted triple or a sequence).
 * @param {Term} term An RDFJS term.
 */
export function isCompoundTerm(term: RDF.Term): term is CompoundTerm {
  return term.termType === 'Quad' || term.termType === 'Sequence';
}

/**
 * rdf-array: the direct children of a quoted triple or a sequence, each with its key.
 * @param {CompoundTerm} term A quoted triple or a sequence.
 */
export function getChildTerms(term: CompoundTerm): [NestedTermKey, RDF.Term][] {
  return term.termType === 'Quad' ?
    QUAD_TERM_NAMES.map((key): [NestedTermKey, RDF.Term] => [ key, term[key] ]) :
    term.elements.map((element, index): [NestedTermKey, RDF.Term] => [ index, element ]);
}

/**
 * rdf-array: rebuild a quoted triple or a sequence from (mapped) children, in the order of {@link getChildTerms}.
 */
function buildCompoundTerm(term: CompoundTerm, children: RDF.Term[], dataFactory: RDF.DataFactory<any>): RDF.Term {
  if (term.termType === 'Quad') {
    return dataFactory.quad(children[0], children[1], children[2], children[3]);
  }
  if (!dataFactory.sequence) {
    throw new Error(`Missing 'sequence()' method on the given DataFactory`);
  }
  return dataFactory.sequence(children);
}

/**
 * rdf-array: a sequence matches a sequence pattern of the same length whose elements each match
 * (see {@link matchTerm}).
 * @param {Sequence} sequence A sequence (can not contain variables).
 * @param {Sequence} pattern A sequence pattern (can contain variables).
 */
export function matchSequence(sequence: RDF.Sequence, pattern: RDF.Sequence): boolean {
  return sequence.elements.length === pattern.elements.length &&
    pattern.elements.every((element, index) => matchTerm(sequence.elements[index], element));
}

/**
 * An RDFJS term with a quad term name key.
 */
export interface INamedTerm {
  /**
   * A quad term name.
   */
  key: QuadTermName;
  /**
   * An RDFJS term.
   */
  value: RDF.Term;
}

/**
 * Get all terms in the given quad.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {boolean} ignoreDefaultGraph If true and the quad has the default graph as graph,
 *                                     this term will not be returned in the array.
 *                                     (default: false)
 * @return {Term[]} The available terms in the quad.
 */
export function getTerms(quad: RDF.BaseQuad, ignoreDefaultGraph?: boolean): RDF.Term[] {
  if (ignoreDefaultGraph && quad.graph.termType === 'DefaultGraph') {
    return [ quad.subject, quad.predicate, quad.object ];
  }
  return [ quad.subject, quad.predicate, quad.object, quad.graph ];
}

/**
 * Get all terms in the given quad, including nested quads.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {boolean} ignoreDefaultGraph If true and the quad has the default graph as graph,
 *                                     this term will not be returned in the array.
 *                                     (default: false)
 * @return {Term[]} The available terms in the nested quad, excluding quad terms.
 */
export function getTermsNested(quad: RDF.BaseQuad, ignoreDefaultGraph?: boolean): RDF.Term[] {
  const terms: RDF.Term[] = [];
  for (const term of getTerms(quad, ignoreDefaultGraph)) {
    collectLeafTerms(term, terms, ignoreDefaultGraph);
  }
  return terms;
}

function collectLeafTerms(term: RDF.Term, terms: RDF.Term[], ignoreDefaultGraph?: boolean) {
  if (isCompoundTerm(term)) {
    for (const [ key, child ] of getChildTerms(term)) {
      if (!(ignoreDefaultGraph && key === 'graph' && child.termType === 'DefaultGraph')) {
        collectLeafTerms(child, terms, ignoreDefaultGraph);
      }
    }
  } else {
    terms.push(term);
  }
}

/**
 * Convert the given quad to an array of named terms.
 * This is the reverse operation of {@link collectNamedTerms}.
 * @param {BaseQuad} quad An RDFJS quad.
 * @return {INamedTerm[]} An array of named terms.
 */
export function getNamedTerms(quad: RDF.BaseQuad): INamedTerm[] {
  return [
    { key: 'subject',   value: quad.subject },
    { key: 'predicate', value: quad.predicate },
    { key: 'object',    value: quad.object },
    { key: 'graph',     value: quad.graph },
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
export function collectNamedTerms<Q extends RDF.BaseQuad = RDF.Quad>(
  namedTerms: INamedTerm[], defaultCb?: (termName: QuadTermName) => RDF.Term, dataFactory?: RDF.DataFactory<Q>): Q {
  const elements: {[id: string]: RDF.Term} = {};
  namedTerms.forEach((namedTerm: INamedTerm) => elements[namedTerm.key] = namedTerm.value);
  if (defaultCb) {
    elements.subject   = elements.subject   || defaultCb('subject');
    elements.predicate = elements.predicate || defaultCb('predicate');
    elements.object    = elements.object    || defaultCb('object');
    elements.graph     = elements.graph     || defaultCb('graph');
  }
  return (dataFactory || <RDF.DataFactory<Q>> <any> DF).quad(
    elements.subject, elements.predicate, elements.object, elements.graph);
}

/**
 * Iterates over each term.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} cb A callback function.
 */
export function forEachTerms(quad: RDF.BaseQuad,
                             cb: (value: RDF.Term, key: QuadTermName) => void) {
  cb(quad.subject,   'subject');
  cb(quad.predicate, 'predicate');
  cb(quad.object,    'object');
  cb(quad.graph,     'graph');
}

/**
 * Iterates over each leaf term, while recursing into quoted triples and (rdf-array) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} cb A callback function.
 * @param QuadTermName[] keys The current key path.
 */
export function forEachTermsNested(quad: RDF.BaseQuad,
                                   cb: (value: RDF.Term, keys: NestedTermKey[]) => void,
                                   keys: NestedTermKey[] = []) {
  for (const [ key, child ] of getChildTerms(quad)) {
    const path = [ ...keys, key ];
    if (isCompoundTerm(child)) {
      forEachTermsNested(<RDF.BaseQuad> child, cb, path);
    } else {
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
export function filterTerms(quad: RDF.BaseQuad, filter: (value: RDF.Term, key: QuadTermName) => boolean): RDF.Term[] {
  const terms: RDF.Term[] = [];
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
 * Get all terms in the given quad that return true on the given filter function, while recursing into quoted triples and (rdf-array) sequences.
 * @param {BaseQuad} quad A quad.
 * @param {(value: Term, key: QuadTermName) => boolean} filter A filter callback.
 * @param QuadTermName[] keys The current key path.
 * @return {Term[]} The list of matching terms.
 */
export function filterTermsNested(quad: RDF.BaseQuad, filter: (value: RDF.Term, keys: NestedTermKey[]) => boolean,
                                  keys: NestedTermKey[] = []): RDF.Term[] {
  const terms: RDF.Term[] = [];
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
export function filterQuadTermNames(quad: RDF.BaseQuad,
                                    filter: (value: RDF.Term, key: QuadTermName) => boolean): QuadTermName[] {
  const names: QuadTermName[] = [];
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
 * Get all quad term names in the given quad that return true on the given filter function, while recursing into quoted triples and (rdf-array) sequences.
 * @param {BaseQuad} quad A quad.
 * @param {(value: Term, key: QuadTermName, all: INamedTerm[]) => boolean} filter A filter callback.
 * @param QuadTermName[] keys The current key path.
 * @return {QuadTermName[]} The list of matching quad term names.
 */
export function filterQuadTermNamesNested(quad: RDF.BaseQuad,
                                          filter: (value: RDF.Term, keys: NestedTermKey[]) => boolean,
                                          keys: NestedTermKey[] = []): NestedTermKey[][] {
  const names: NestedTermKey[][] = [];
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
export function mapTerms<Q extends RDF.BaseQuad = RDF.Quad>(quad: Q,
                                                            mapper: (term: RDF.Term, key: QuadTermName) => RDF.Term,
                                                            dataFactory?: RDF.DataFactory<Q>): Q {
  return (dataFactory || <RDF.DataFactory<Q>> <any> DF).quad(
    mapper(quad.subject, 'subject'),
    mapper(quad.predicate, 'predicate'),
    mapper(quad.object, 'object'),
    mapper(quad.graph, 'graph'),
  );
}

/**
 * Map all terms of a quad, while recursing into quoted triples and (rdf-array) sequences.
 * @param {Quad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName) => Term} mapper A mapper function.
 * @param {RDF.DataFactory} dataFactory A custom data factory to create quads.
 * @param QuadTermName[] keys The current key path.
 * @return {Quad} A new RDFJS quad.
 * @template Q The type of quad, defaults to RDF.Quad.
 */
export function mapTermsNested<Q extends RDF.BaseQuad = RDF.Quad>(quad: Q,
                                                                  mapper: (term: RDF.Term, keys: NestedTermKey[]) => RDF.Term,
                                                                  dataFactory?: RDF.DataFactory<Q>,
                                                                  keys: NestedTermKey[] = []): Q {
  return <Q> mapCompoundTerm(quad, mapper, dataFactory || <RDF.DataFactory<Q>> <any> DF, keys);
}

function mapCompoundTerm(term: CompoundTerm,
                         mapper: (term: RDF.Term, keys: NestedTermKey[]) => RDF.Term,
                         dataFactory: RDF.DataFactory<any>,
                         keys: NestedTermKey[]): RDF.Term {
  return buildCompoundTerm(term, getChildTerms(term).map(([ key, child ]) => {
    const path = [ ...keys, key ];
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
export function reduceTerms<U>(quad: RDF.BaseQuad,
                               reducer: (previousValue: U, currentValue: RDF.Term, key: QuadTermName) => U,
                               initialValue: U): U {
  let value: U = initialValue;
  value = reducer(value, quad.subject,   'subject');
  value = reducer(value, quad.predicate, 'predicate');
  value = reducer(value, quad.object,    'object');
  return  reducer(value, quad.graph,     'graph');
}

/**
 * Reduce all terms of a quad, while recursing into quoted triples and (rdf-array) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(previousValue: U, currentValue: Term, key: QuadTermName) => U} reducer A reduce function.
 * @param {U} initialValue The initial value.
 * @param QuadTermName[] keys The current key path.
 * @return {U} The final value.
 */
export function reduceTermsNested<U>(quad: RDF.BaseQuad,
                                     reducer: (previousValue: U, currentValue: RDF.Term, keys: NestedTermKey[]) => U,
                                     initialValue: U,
                                     keys: NestedTermKey[] = []): U {
  let value: U = initialValue;
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
export function everyTerms(quad: RDF.BaseQuad,
                           checker: (value: RDF.Term, key: QuadTermName) => boolean): boolean {
  return checker(quad.subject,   'subject')
      && checker(quad.predicate, 'predicate')
      && checker(quad.object,    'object')
      && checker(quad.graph,     'graph');
}

/**
 * Determines whether all terms satisfy the specified test, while recursing into quoted triples and (rdf-array) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @param QuadTermName[] keys The current key path.
 * @return {boolean} If all terms satisfy the specified test.
 */
export function everyTermsNested(quad: RDF.BaseQuad,
                                 checker: (value: RDF.Term, keys: NestedTermKey[]) => boolean,
                                 keys: NestedTermKey[] = []): boolean {
  return getChildTerms(quad).every(([ key, child ]) => isCompoundTerm(child) ?
    everyTermsNested(<RDF.BaseQuad> child, checker, [ ...keys, key ]) :
    checker(child, [ ...keys, key ]));
}

/**
 * Determines whether at least one term satisfies the specified test.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @return {boolean} If at least one term satisfies the specified test.
 */
export function someTerms(quad: RDF.BaseQuad,
                          checker: (value: RDF.Term, key: QuadTermName) => boolean): boolean {
  return checker(quad.subject,   'subject')
      || checker(quad.predicate, 'predicate')
      || checker(quad.object,    'object')
      || checker(quad.graph,     'graph');
}

/**
 * Determines whether at least one term satisfies the specified test, while recursing into quoted triples and (rdf-array) sequences.
 * @param {BaseQuad} quad An RDFJS quad.
 * @param {(value: Term, key: QuadTermName} checker A checker function.
 * @param QuadTermName[] keys The current key path.
 * @return {boolean} If at least one term satisfies the specified test.
 */
export function someTermsNested(quad: RDF.BaseQuad,
                                checker: (value: RDF.Term, keys: NestedTermKey[]) => boolean,
                                keys: NestedTermKey[] = []): boolean {
  return getChildTerms(quad).some(([ key, child ]) => isCompoundTerm(child) ?
    someTermsNested(<RDF.BaseQuad> child, checker, [ ...keys, key ]) :
    checker(child, [ ...keys, key ]));
}

/**
 * Get the nested value inside a quoted triple or (rdf-array) a sequence by the given path of keys.
 * @param term A term, that can be a quoted triple or a sequence.
 * @param keys A path of quad term names and sequence element indexes.
 */
export function getValueNestedPath(term: RDF.Term, keys: NestedTermKey[]): RDF.Term {
  if (keys.length === 0) {
    return term;
  }
  const [ key, ...rest ] = keys;
  if (term.termType === 'Quad' && typeof key === 'string') {
    return getValueNestedPath(term[key], rest);
  }
  if (term.termType === 'Sequence') {
    // rdf-array: the key is the element index (possibly spelled as a string)
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
 * * (rdf-array) Term A and B are sequences, and return true for `matchSequence`.
 * * Quad term and term are equal (`termB.equals(termA)` return true)
 *
 * @param termA A term.
 * @param termB An optional term.
 */
export function matchTerm(termA: RDF.Term, termB?: RDF.Term): boolean {
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
export function matchPattern(quad: RDF.BaseQuad, subject?: RDF.Term, predicate?: RDF.Term,
                             object?: RDF.Term, graph?: RDF.Term): boolean {
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
export function matchPatternComplete(quad: RDF.BaseQuad, pattern: RDF.BaseQuad): boolean {
  return matchPattern(quad, pattern.subject, pattern.predicate, pattern.object, pattern.graph);
}

/**
 * Check if the first quad matches against all terms in the pattern,
 * by taking into account the mappings of the variables.
 * If the same variable occurs multiple times in the pattern,
 * then the corresponding terms in the quad must be equal.
 *
 * Each term in the quad must satisfy the following:
 * * The pattern term is a variable, and all other variables with the same value - map to the same terms in the quad
 * * Both the quad term and pattern term are quads - and they satisfy the same conditions
 * * The pattern and quad terms are equal and not variables or quads
 *
 * @param quad A quad - possibly containing variables
 * @param pattern A pattern - possibly containing variables
 * @param options
 *    skipVarMapping - don't add variables in the quad to the mapping
 *    returnMappings - return the mappings if it is a valid match
 */
export function matchPatternMappings(quad: RDF.BaseQuad, pattern: RDF.BaseQuad): boolean;
export function matchPatternMappings(quad: RDF.BaseQuad, pattern: RDF.BaseQuad, opt: { skipVarMapping?: boolean; returnMappings?: false }): boolean;
export function matchPatternMappings(quad: RDF.BaseQuad, pattern: RDF.BaseQuad, opt: { skipVarMapping?: boolean; returnMappings: true }): false | Record<string, RDF.Term>;
export function matchPatternMappings(quad: RDF.BaseQuad, pattern: RDF.BaseQuad, opt: PatternOptions = {}): boolean | Record<string, RDF.Term> {
  const map: Record<string, RDF.Term> = {};
  function matchTerms(t1: RDF.Term, t2: RDF.Term): boolean {
    switch (t1.termType) {
    case 'Variable':
      return ((opt.skipVarMapping ?? false) && t2.termType === 'Variable') ||
      (map[t1.value]?.equals(t2) ?? (map[t1.value] = t2, true));
    case 'Quad':
      return t2.termType === 'Quad' && match(t1, t2);
    case 'Sequence':
      // rdf-array: element by element, variables inside the pattern's sequence included
      return t2.termType === 'Sequence' && t1.elements.length === t2.elements.length &&
        t1.elements.every((element, index) => matchTerms(element, t2.elements[index]));
    default:
      return t1.equals(t2);
    }
  }
  function match(_pattern: RDF.BaseQuad, _quad: RDF.BaseQuad): boolean {
    return everyTerms(_pattern, (t1, key) => matchTerms(t1, _quad[key]));
  }
  return match(pattern, quad) && (opt.returnMappings ? map : true);
}

interface PatternOptions {
  skipVarMapping?: boolean;
  returnMappings?: boolean;
}
