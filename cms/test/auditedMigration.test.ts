import { describe, expect, it } from 'vitest';
import { findAuditedMatches, type AuditedValueRule } from '../content/auditedMigration';

describe('audited CMS migration', () => {
  const rules: AuditedValueRule[] = [
    { entryId: 'entry', key: 'title', from: 'Valor antiguo', to: 'Valor auditado' },
    {
      entryId: 'entry',
      key: 'body',
      from: 'afirmación absoluta',
      to: 'afirmación delimitada',
      mode: 'substring',
    },
  ];

  it('updates only exact questioned values', () => {
    const matches = findAuditedMatches(
      [
        { entryId: 'entry', key: 'title', value: 'Valor antiguo editado' },
        { entryId: 'entry', key: 'body', value: 'Texto con afirmación absoluta.' },
      ],
      rules
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].nextValue).toBe('Texto con afirmación delimitada.');
  });

  it('is idempotent after applying a migration', () => {
    const first = findAuditedMatches(
      [{ entryId: 'entry', key: 'title', value: 'Valor antiguo' }],
      rules
    );
    expect(first).toHaveLength(1);

    const second = findAuditedMatches(
      [{ entryId: 'entry', key: 'title', value: first[0].nextValue }],
      rules
    );
    expect(second).toHaveLength(0);
  });
});
