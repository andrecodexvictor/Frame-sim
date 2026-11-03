const normalized=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();

export function mentionsPersonaName(role:unknown,name:unknown):boolean {
    if(typeof role!=='string'||typeof name!=='string')return false;
    const text=normalized(role),person=normalized(name);
    if(person.length<3)return false;
    const escaped=person.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`,'u').test(text);
}

/** Ambiguous or absent identity stays unresolved; position is never identity. */
export function resolvePersonaIdentity<T extends {id:string;nome:string}>(role:unknown,people:readonly T[]):T|undefined {
    const matches=people.filter(person=>mentionsPersonaName(role,person.nome));
    return matches.length===1?matches[0]:undefined;
}
