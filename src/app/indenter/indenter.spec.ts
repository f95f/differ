import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Indenter } from './indenter';

describe('Indenter', () => {
  let component: Indenter;
  let fixture: ComponentFixture<Indenter>;
  let httpMock: HttpTestingController;
  let clipboardText = '';
  let copiedText = '';

  const sampleJson = '{"name":"Differ","features":["paste","copy"]}';
  const formattedSample = JSON.stringify(JSON.parse(sampleJson), null, 2);

  beforeEach(async () => {
    clipboardText = '';
    copiedText = '';

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: () => Promise.resolve(clipboardText),
        writeText: (text: string) => {
          copiedText = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [Indenter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Indenter);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushSample(): void {
    httpMock.expectOne('/sample-json-example.json').flush(sampleJson);
  }

  it('should create', () => {
    flushSample();

    expect(component).toBeTruthy();
  });

  it('loads the sample as minified left text and formatted right text', () => {
    flushSample();

    expect(component.leftText).toBe(sampleJson);
    expect(component.rightText).toBe(formattedSample);
  });

  it('updates both sides when valid json is pasted into the left side', async () => {
    flushSample();
    clipboardText = '{ "active": true, "items": [1, 2] }';

    await component.pasteInSide('left');

    expect(component.leftText).toBe('{"active":true,"items":[1,2]}');
    expect(component.rightText).toBe(JSON.stringify({ active: true, items: [1, 2] }, null, 2));
    expect(component.leftError).toBe('');
    expect(component.rightError).toBe('');
  });

  it('updates both sides when valid json is pasted into the right side', async () => {
    flushSample();
    clipboardText = '{ "name": "JSON", "nested": { "ok": true } }';

    await component.pasteInSide('right');

    expect(component.leftText).toBe('{"name":"JSON","nested":{"ok":true}}');
    expect(component.rightText).toBe(JSON.stringify({ name: 'JSON', nested: { ok: true } }, null, 2));
  });

  it('replicates raw invalid pasted text on both sides', async () => {
    flushSample();
    clipboardText = '{ "broken": true';

    await component.pasteInSide('left');

    expect(component.leftText).toBe('{ "broken": true');
    expect(component.rightText).toBe('{ "broken": true');
    expect(component.leftError).toContain('JSON');
    expect(component.rightError).toContain('JSON');
  });

  it('formats from the last edited side when requested', () => {
    flushSample();
    component.rightText = '{ "typed": true, "count": 2 }';
    component.onSideInput('right');

    component.format();

    expect(component.leftText).toBe('{"typed":true,"count":2}');
    expect(component.rightText).toBe(JSON.stringify({ typed: true, count: 2 }, null, 2));
  });

  it('keeps content unchanged when format finds invalid json', () => {
    flushSample();
    component.leftText = '{ "broken": true';
    component.rightText = formattedSample;
    component.onSideInput('left');

    component.format();

    expect(component.leftText).toBe('{ "broken": true');
    expect(component.rightText).toBe(formattedSample);
    expect(component.leftError).toContain('JSON');
  });

  it('copies the current side text', async () => {
    flushSample();
    component.rightText = '{\n  "copy": true\n}';

    await component.copySide('right');

    expect(copiedText).toBe('{\n  "copy": true\n}');
  });

  it('clears both sides and errors', () => {
    flushSample();
    component.leftError = 'Invalid left';
    component.rightError = 'Invalid right';

    component.clearAll();

    expect(component.leftText).toBe('');
    expect(component.rightText).toBe('');
    expect(component.leftError).toBe('');
    expect(component.rightError).toBe('');
  });

  it('clears only the requested side and its error', () => {
    flushSample();
    component.leftError = 'Invalid left';
    component.rightError = 'Invalid right';

    component.clearLeft();

    expect(component.leftText).toBe('');
    expect(component.rightText).toBe(formattedSample);
    expect(component.leftError).toBe('');
    expect(component.rightError).toBe('Invalid right');

    component.clearRight();

    expect(component.rightText).toBe('');
    expect(component.rightError).toBe('');
  });
});
