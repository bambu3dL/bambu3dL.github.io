// Gli stati di una richiesta, nell'ordine in cui si attraversano.
// Come vengano mostrati al cliente (email, pagina di stato) è ancora da decidere.
export const REQUEST_STATUSES = Object.freeze(['received', 'reviewing', 'quoted', 'confirmed', 'printing', 'ready']);
