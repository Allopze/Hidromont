/**
 * E2E tests: Navegación del sitio público, accesibilidad y controles interactivos.
 * Cubre: menú móvil con foco accesible y Escape, dropdowns de escritorio, toggle de marquesina,
 * filtros con teclado (roving tabindex) y estados vacíos con botón de limpieza.
 */
import { test, expect } from '@playwright/test';

test.describe('Navegación pública e interactividad', () => {
  test('menú móvil: apertura, foco accesible, alternancia de iconos y cierre con Escape', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const toggleBtn = page.locator('#menu-toggle');
    const mobileMenu = page.locator('#mobile-menu');
    const iconMenu = page.locator('#icon-menu');
    const iconClose = page.locator('#icon-close');

    await expect(toggleBtn).toBeVisible();
    await expect(mobileMenu).toBeHidden();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(iconMenu).toBeVisible();
    await expect(iconClose).toBeHidden();

    // 1. Abrir menú
    await toggleBtn.click();
    await expect(mobileMenu).toBeVisible();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(iconMenu).toBeHidden();
    await expect(iconClose).toBeVisible();

    // El foco debe haberse movido al primer control interactivo del menú
    const firstLink = mobileMenu.locator('a, summary, button').first();
    await expect(firstLink).toBeFocused();

    // 2. Cerrar con tecla Escape
    await page.keyboard.press('Escape');
    await expect(mobileMenu).toBeHidden();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(iconMenu).toBeVisible();
    await expect(iconClose).toBeHidden();

    // El foco debe volver al botón que abrió el menú
    await expect(toggleBtn).toBeFocused();
  });

  test('dropdown de servicios en escritorio: despliegue con teclado y cierre con Escape', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const dropdownToggle = page.locator('[data-dropdown-toggle]').first();
    const group = dropdownToggle.locator('xpath=ancestor::*[@data-dropdown-group][1]');
    const panel = group.locator('.dropdown-panel');

    await expect(dropdownToggle).toBeVisible();
    await expect(dropdownToggle).toHaveAttribute('aria-expanded', 'false');

    // 1. Abrir con clic o teclado
    await dropdownToggle.click();
    await expect(panel).toHaveClass(/is-open/);
    await expect(dropdownToggle).toHaveAttribute('aria-expanded', 'true');

    // 2. Presionar Escape dentro del grupo debe cerrarlo y devolver el foco al toggler
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveClass(/is-open/);
    await expect(dropdownToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(dropdownToggle).toBeFocused();
  });

  test('P2-29: tabular por «Servicios» no abre el submenú; Intro en el chevron sí', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const chevron = page.locator('[data-dropdown-toggle]').first();
    const group = chevron.locator('xpath=ancestor::*[@data-dropdown-group][1]');
    const panel = group.locator('.dropdown-panel');
    const enlace = group.locator('a').first();

    await enlace.focus();
    await expect(panel).not.toHaveClass(/is-open/);
    await page.keyboard.press('Tab');
    await expect(chevron).toBeFocused();
    await expect(panel).not.toHaveClass(/is-open/);

    await page.keyboard.press('Enter');
    await expect(panel).toHaveClass(/is-open/);
    // Salir tabulando del grupo lo cierra.
    const enlacesDelPanel = await panel.locator('a').count();
    for (let i = 0; i <= enlacesDelPanel; i++) await page.keyboard.press('Tab');
    await expect(group.locator(':focus')).toHaveCount(0);
    await expect(panel).not.toHaveClass(/is-open/);
  });

  test('P2-29: Escape cierra el submenú aunque el foco no esté en él', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const chevron = page.locator('[data-dropdown-toggle]').first();
    const panel = chevron
      .locator('xpath=ancestor::*[@data-dropdown-group][1]')
      .locator('.dropdown-panel');
    await chevron.click();
    await expect(panel).toHaveClass(/is-open/);
    // Como deja Safari el foco tras pulsar el chevron.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(5, 700);
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveClass(/is-open/);
  });

  test('control de pausa de carrusel de logos (MarqueePauseToggle)', async ({ page }) => {
    await page.goto('/clientes');

    const pauseToggle = page.locator('.marquee-pause-toggle').first();
    if ((await pauseToggle.count()) === 0) return;

    await expect(pauseToggle).toBeVisible();
    await expect(pauseToggle).toHaveAttribute('aria-pressed', 'false');

    // 1. Pausar la animación
    await pauseToggle.click();
    await expect(pauseToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(pauseToggle).toHaveAttribute('aria-label', /Reanudar/i);

    const region = page.locator('.marquee-region').first();
    await expect(region).toHaveClass(/is-paused/);

    // 2. Reanudar la animación
    await pauseToggle.click();
    await expect(pauseToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(pauseToggle).toHaveAttribute('aria-label', /Pausar/i);
    await expect(region).not.toHaveClass(/is-paused/);
  });

  test('banco de proyectos: navegación por píldoras de filtro con flechas y estado vacío', async ({
    page,
  }) => {
    await page.goto('/proyectos');

    const pills = page.locator('#project-filter-container [data-filter]');
    await expect(pills.first()).toBeVisible();

    // Navegación por teclado con roving tabindex
    await pills.first().focus();
    await expect(pills.first()).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(pills.nth(1)).toBeFocused();

    // Búsqueda con término que no existe -> comprobar estado sin resultados
    const searchInput = page.locator('#project-search');
    await searchInput.fill('termino_imposible_xyz_999');

    const resultsCount = page.locator('#project-results-count');
    await expect(resultsCount).toContainText('Mostrando 0 de 0 proyectos');

    const loadMoreBtn = page.locator('#project-load-more-wrap');
    await expect(loadMoreBtn).toHaveClass(/hidden/);
  });

  test('galería: estado sin resultados y botón para limpiar búsqueda', async ({ page }) => {
    await page.goto('/galeria');

    const searchInput = page.locator('#gallery-search');
    await expect(searchInput).toBeVisible();

    // Buscar término inexistente
    await searchInput.fill('busqueda_sin_coincidencias_999');

    const noResults = page.locator('#no-results');
    await expect(noResults).toBeVisible();
    await expect(page.locator('#results-count')).toContainText('No se encontraron fotos');

    // Botón de limpiar búsqueda
    const clearBtn = page.locator('#gallery-search-clear');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // La galería debe restaurar sus imágenes
    await expect(noResults).toBeHidden();
    await expect(page.locator('#photo-wall .gallery-card').first()).toBeVisible();
  });
});
