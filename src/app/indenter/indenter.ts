import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { ThemeService } from '../shared/theme.service';

type JsonSide = 'left' | 'right';

const DEFAULT_SAMPLE_JSON = `{
  "tool": "Differ",
  "mode": "json",
  "features": [
    "paste",
    "copy",
    "format"
  ],
  "sample": {
    "minifiedOnLeft": true,
    "formattedOnRight": true,
    "indentation": 2
  }
}`;

@Component({
  selector: 'app-indenter',
  imports: [
    MonacoEditorModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './indenter.html',
  styleUrl: './indenter.scss'
})
export class Indenter {
  private readonly client = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  readonly themeService = inject(ThemeService);

  isClearMenuExpanded = false;
  leftText = this.minifyJson(DEFAULT_SAMPLE_JSON);
  rightText = this.formatJson(DEFAULT_SAMPLE_JSON);
  leftError = '';
  rightError = '';
  lastEditedSide: JsonSide | null = null;

  private leftEditor: any;
  private rightEditor: any;

  editorOptions: any = {
    theme: this.getMonacoTheme(),
    language: 'json',
    automaticLayout: true,
    minimap: { enabled: false },
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    scrollBeyondLastLine: false,
  };

  private readonly themeEffect = effect(() => {
    const monacoTheme = this.getMonacoTheme();

    this.defineMonacoTheme();
    this.editorOptions = {
      ...this.editorOptions,
      theme: monacoTheme,
    };
    this.applyMonacoTheme(monacoTheme);
  });

  ngOnInit(): void {
    this.client.get('/sample-json-example.json', { responseType: 'text' })
      .subscribe(data => this.applyJson(data));
  }

  get leftLength(): number {
    return this.leftText.length;
  }

  get rightLength(): number {
    return this.rightText.length;
  }

  onLeftEditorInit(editor: any): void {
    this.leftEditor = editor;
    this.configureEditor(editor, 'left');
    this.syncSideEditor('left');
  }

  onRightEditorInit(editor: any): void {
    this.rightEditor = editor;
    this.configureEditor(editor, 'right');
    this.syncSideEditor('right');
  }

  async pasteInSide(side: JsonSide): Promise<void> {
    const text = await navigator.clipboard.readText();
    const applied = this.applyJson(text);

    if (!applied) {
      this.leftText = text;
      this.rightText = text;
      this.syncEditors();
      this.leftError = this.createJsonError(text);
      this.rightError = this.leftError;
      this.lastEditedSide = side;
    }
  }

  async copySide(side: JsonSide): Promise<void> {
    await navigator.clipboard.writeText(this.getSideText(side));
  }

  format(): void {
    const side = this.resolveFormatSourceSide();
    const text = this.getSideText(side);
    const applied = this.applyJson(text);

    if (!applied) {
      this.setSideError(side, this.createJsonError(text));
    }
  }

  clearAll(): void {
    this.leftText = '';
    this.rightText = '';
    this.leftError = '';
    this.rightError = '';
    this.lastEditedSide = null;
    this.syncEditors();
  }

  clearLeft(): void {
    this.leftText = '';
    this.leftError = '';
    if (this.lastEditedSide === 'left') {
      this.lastEditedSide = null;
    }
    this.syncSideEditor('left');
  }

  clearRight(): void {
    this.rightText = '';
    this.rightError = '';
    if (this.lastEditedSide === 'right') {
      this.lastEditedSide = null;
    }
    this.syncSideEditor('right');
  }

  onSideInput(side: JsonSide): void {
    this.lastEditedSide = side;
    this.setSideError(side, '');
  }

  setClearMenuExpanded(isExpanded: boolean): void {
    this.isClearMenuExpanded = isExpanded;
  }

  applyJson(text: string): boolean {
    try {
      const parsed = JSON.parse(text);

      this.leftText = JSON.stringify(parsed);
      this.rightText = JSON.stringify(parsed, null, 2);
      this.leftError = '';
      this.rightError = '';
      this.syncEditors();
      return true;
    } catch {
      return false;
    }
  }

  private minifyJson(text: string): string {
    return JSON.stringify(JSON.parse(text));
  }

  private formatJson(text: string): string {
    return JSON.stringify(JSON.parse(text), null, 2);
  }

  private resolveFormatSourceSide(): JsonSide {
    if (this.lastEditedSide) {
      return this.lastEditedSide;
    }

    if (this.rightText.trim()) {
      return 'right';
    }

    return 'left';
  }

  private getSideText(side: JsonSide): string {
    const editor = side === 'left' ? this.leftEditor : this.rightEditor;

    return editor?.getModel?.()?.getValue?.() ?? (side === 'left' ? this.leftText : this.rightText);
  }

  private setSideText(side: JsonSide, text: string): void {
    if (side === 'left') {
      this.leftText = text;
      return;
    }

    this.rightText = text;
  }

  private setSideError(side: JsonSide, error: string): void {
    if (side === 'left') {
      this.leftError = error;
      return;
    }

    this.rightError = error;
  }

  private createJsonError(text: string): string {
    try {
      JSON.parse(text);
      return '';
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Invalid JSON';
      return `Invalid JSON: ${detail}`;
    }
  }

  private getMonacoTheme(): string {
    return this.themeService.theme() === 'dark' ? 'differ-dark' : 'vs';
  }

  private defineMonacoTheme(): void {
    const monaco = (window as any).monaco;

    if (!monaco) {
      return;
    }

    const styles = getComputedStyle(document.documentElement);
    const editorBackground = this.toMonacoColor(styles.getPropertyValue('--editor-background'));
    const foreground = this.toMonacoColor(styles.getPropertyValue('--grey-darker'));
    const lineNumber = this.toMonacoColor(styles.getPropertyValue('--grey-dark'));
    const selectionBackground = this.toMonacoColor(styles.getPropertyValue('--grey'));
    const border = this.toMonacoColor(styles.getPropertyValue('--base-dark'));

    monaco.editor.defineTheme('differ-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': editorBackground,
        'editor.foreground': foreground,
        'editorGutter.background': editorBackground,
        'editorLineNumber.foreground': lineNumber,
        'editorLineNumber.activeForeground': foreground,
        'editor.selectionBackground': selectionBackground,
        'editor.inactiveSelectionBackground': selectionBackground,
        'editorIndentGuide.background1': border,
        'editorIndentGuide.activeBackground1': foreground,
      },
    });
  }

  private applyMonacoTheme(theme: string): void {
    (window as any).monaco?.editor?.setTheme(theme);
  }

  private toMonacoColor(color: string): string {
    return color.trim();
  }

  private configureEditor(editor: any, side: JsonSide): void {
    if (!editor) {
      return;
    }

    this.defineMonacoTheme();
    this.applyMonacoTheme(this.getMonacoTheme());

    editor.updateOptions?.({
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
    });
    editor.getModel?.()?.updateOptions?.({ tabSize: 2, insertSpaces: true });
    editor.onDidFocusEditorText?.(() => {
      this.ngZone.run(() => {
        this.lastEditedSide = side;
      });
    });
  }

  private syncEditors(): void {
    this.syncSideEditor('left');
    this.syncSideEditor('right');
  }

  private syncSideEditor(side: JsonSide): void {
    const editor = side === 'left' ? this.leftEditor : this.rightEditor;
    const text = side === 'left' ? this.leftText : this.rightText;
    const model = editor?.getModel?.();

    if (model && model.getValue() !== text) {
      model.setValue(text);
    }
  }
}
