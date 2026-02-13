process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}));

describe('code-markdowns normalization', () => {
  const codeMarkdowns = require('../api/code-markdowns');
  const { splitPlantillas, normalizeItem } = codeMarkdowns.__test__;

  test('splitPlantillas separa por comas dentro de arrays y elimina vacíos', () => {
    expect(splitPlantillas(['A (Formulario), B (Documento)', ' C (Subproceso) ', '', null])).toEqual([
      'A (Formulario)',
      'B (Documento)',
      'C (Subproceso)',
    ]);
  });

  test('normalizeItem devuelve plantillas únicas en orden', () => {
    const normalized = normalizeItem({
      id: 1,
      proyecto: 'Proyecto 1',
      plantillas: ['Alta (Formulario), Firma (Documento)', 'Alta (Formulario)'],
    });

    expect(normalized.plantillas).toEqual(['Alta (Formulario)', 'Firma (Documento)']);
  });
});
