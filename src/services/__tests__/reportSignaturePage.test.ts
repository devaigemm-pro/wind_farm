import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { renderManagerSignaturePage } from '../reportSignaturePage';

const base = {
  windFarmName: 'Parque Test',
  purpose: 'Limpieza de turbina eólica',
  managerName: 'Víctor Hugo',
  managerRole: 'Jefe de O&M',
  managerSignature: null,
  titleColor: [90, 143, 90] as [number, number, number],
};

describe('renderManagerSignaturePage', () => {
  it('adds one page with legal text, purpose, manager name and role', () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    renderManagerSignaturePage(doc, base);
    expect(doc.getNumberOfPages()).toBe(2);
    const text = (doc.output() as string);
    expect(text).toContain('Derechos de informe');
    expect(text).toContain('Parque Test');
    expect(text).toContain('JEFE DE O&M');
  });

  it('embeds the signature image when provided', () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const png =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const doc0 = new jsPDF('p', 'mm', 'a4');
    renderManagerSignaturePage(doc0, base);
    const doc1 = new jsPDF('p', 'mm', 'a4');
    renderManagerSignaturePage(doc1, { ...base, managerSignature: png });
    expect(doc1.output().length).toBeGreaterThan(doc0.output().length);
  });
});
