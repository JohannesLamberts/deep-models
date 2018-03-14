export class FnArraySet {
    static aWithoutB(a: any[], b: any[]): any[] {
        return a.filter(aVal =>                     // elements of a
                            !b.some(bVal => bVal === aVal));        // that are not contained in b
    }

    static union(a: any[], b: any[]): any[] {
        return a.concat(// elements of a with
                        b.filter(bVal =>                        // with elements of b
                                     !a.some(aVal => aVal === bVal)));   // that are not contained in a
    }

    static intersection(a: any[], b: any[]): any[] {
        return a.filter(aVal =>                     // elements of a
                            b.some(bVal => bVal === aVal));         // that are contained in b
    }
}