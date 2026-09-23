import { describe, expect, it } from 'vitest';
import { isEditorHost, shouldActivateOverlay } from '../scripts/cms/overlay/index';

describe('CMS Overlay Activation', () => {
  describe('isEditorHost', () => {
    it('identifica subdominios editor.* en producción y staging', () => {
      expect(isEditorHost('editor.hidromontchile.cl')).toBe(true);
      expect(isEditorHost('editor.staging.hidromontchile.cl')).toBe(true);
    });

    it('identifica subdominios editor.* en local', () => {
      expect(isEditorHost('editor.localhost')).toBe(true);
    });

    it('retorna false para dominios públicos estándar', () => {
      expect(isEditorHost('hidromontchile.cl')).toBe(false);
      expect(isEditorHost('www.hidromontchile.cl')).toBe(false);
      expect(isEditorHost('localhost')).toBe(false);
      expect(isEditorHost('127.0.0.1')).toBe(false);
    });
  });

  describe('shouldActivateOverlay', () => {
    it('activa automáticamente si el host es editor.*', () => {
      expect(shouldActivateOverlay('editor.hidromontchile.cl', '', null)).toBe(true);
      expect(shouldActivateOverlay('editor.localhost', '', null)).toBe(true);
      // Incluso con query params o storage vacíos
      expect(shouldActivateOverlay('editor.hidromontchile.cl', '?foo=bar', null)).toBe(true);
    });

    it('no activa en host público sin parámetros ni almacenamiento', () => {
      expect(shouldActivateOverlay('hidromontchile.cl', '', null)).toBe(false);
      expect(shouldActivateOverlay('www.hidromontchile.cl', '', null)).toBe(false);
      expect(shouldActivateOverlay('localhost', '', null)).toBe(false);
    });

    it('activa en cualquier host si se proporciona ?cms=1 (compatibilidad)', () => {
      expect(shouldActivateOverlay('hidromontchile.cl', '?cms=1', null)).toBe(true);
      expect(shouldActivateOverlay('localhost', '?cms=1', null)).toBe(true);
      expect(shouldActivateOverlay('localhost', '?foo=1&cms=1&bar=2', null)).toBe(true);
    });

    it('no activa con otros valores de cms distintos de 1', () => {
      expect(shouldActivateOverlay('hidromontchile.cl', '?cms=0', null)).toBe(false);
      expect(shouldActivateOverlay('hidromontchile.cl', '?cms=true', null)).toBe(false);
    });

    it('activa si hay una sesión previa persistida en localStorage', () => {
      expect(shouldActivateOverlay('hidromontchile.cl', '', '1')).toBe(true);
      expect(shouldActivateOverlay('localhost', '', '1')).toBe(true);
      expect(shouldActivateOverlay('hidromontchile.cl', '', '0')).toBe(false);
    });
  });
});
