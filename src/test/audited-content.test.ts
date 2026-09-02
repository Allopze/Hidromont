import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contentFiles = [
  ...globSync('src/content/**/*.md'),
  'cms/content/defaultContent.ts',
  'src/data/cms-content.json',
];

const prohibited = [
  '2014/68/EN',
  'cualquier dimensión',
  'cualquier diámetro y presión',
  'garantizan',
  'todos los trabajos',
  'más de 40 proyectos adicionales',
  'más de 20 proyectos adicionales',
  'te contactaremos',
  'tu mensaje',
];

describe('audited public content', () => {
  it.each(contentFiles)('%s contains no prohibited audited wording', (file) => {
    const contents = readFileSync(file, 'utf8').toLocaleLowerCase('es');
    for (const phrase of prohibited) {
      expect(contents, `${file} still contains “${phrase}”`).not.toContain(
        phrase.toLocaleLowerCase('es')
      );
    }
  });

  it('keeps the audited Los Cóndores scope and excludes unsupported contracts', () => {
    const contents = readFileSync('src/content/proyectos/ch-los-condores.md', 'utf8');
    expect(contents).toContain('1.200 m');
    expect(contents).toContain('132 m');
    expect(contents).toContain('2.448 t');
    expect(contents).not.toMatch(/DN 3\.200|DN 3\.400|89 kg\/cm²/);
  });
});
