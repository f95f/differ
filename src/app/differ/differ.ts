import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, NgZone, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { debounceTime, Subject } from 'rxjs';
import { ThemeService } from '../shared/theme.service';

interface IDiffEditorModel {
  language: string;
  code: string;
  length: number;
}

@Component({
  selector: 'app-differ',
  imports: [
    MonacoEditorModule,
    FormsModule,
    ClickOutsideDirective,
    RouterLink,
  ],
  templateUrl: './differ.html',
  styleUrl: './differ.scss'
})
export class Differ {

  @ViewChild('diffEditor') 
  diffEditorComponent: any;

  private readonly ngZone = inject(NgZone);
  private readonly client = inject(HttpClient);
  readonly themeService = inject(ThemeService);

  private readonly update$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  isClearMenuExpanded = false;
  isEditingOriginalTitle = false;
  isEditingModifiedTitle = false;
  isModifiedTitleHovered = false;
  isOriginalTitleHovered = false;

  originalTitle = 'Sample A';
  modifiedTitle = 'Sample B';

  originalModel: IDiffEditorModel = {
    language: 'plaintext',
    code: '',
    length: 0
  };

  modifiedModel: IDiffEditorModel = {
    language: 'plaintext',
    code: '',
    length: 0
  };

  diffOptions: any = {
    theme: this.getMonacoTheme(),
    renderSideBySide: true,
    automaticLayout: true,
    minimap: { enabled: false },
    originalEditable: true,
    renderIndicators: true,
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
  };

  private readonly themeEffect = effect(() => {
    const monacoTheme = this.getMonacoTheme();

    this.defineMonacoTheme();
    this.diffOptions = {
      ...this.diffOptions,
      theme: monacoTheme,
    };
    this.applyMonacoTheme(monacoTheme);
  });


  ngOnInit(): void {
    this.update$.pipe(debounceTime(240)).subscribe(() => {
      this.applyModelsToEditor();
    });
    this.client.get('/current-running-example-before.txt', { responseType: 'text' })
    .subscribe(data => {
      this.originalModel = { ...this.originalModel, code: data, length: data.length };
      this.update$.next();
    });
    this.client.get('/current-running-example-after.txt', { responseType: 'text' })
    .subscribe(data => {
      this.modifiedModel = { ...this.modifiedModel, code: data, length: data.length };
      this.update$.next();
    });
  }

  // convenience API to inject text programmatically
  setOriginalText(text: string) {
    this.originalModel = { ...this.originalModel, code: text, length: text.length };
    this.update$.next();
  }
  setModifiedText(text: string) {
    this.modifiedModel = { ...this.modifiedModel, code: text, length: text.length };
    this.update$.next();
  }

  setOriginalTextFromClipboard(text: string) {
    navigator.clipboard.readText().then(text => {
      this.setOriginalText(text);
    });
  }
  setModifiedTextFromClipboard(text: string) {
    navigator.clipboard.readText().then(text => {
      this.setModifiedText(text);
    });
  }

  // sync the wrapper-bound models into the actual Monaco diff editor
  applyModelsToEditor() {
    // the ngx wrapper binds inputs to the internal models automatically,
    // but to ensure we can call methods like getLineChanges now:
    try {
      const diffComp = this.diffEditorComponent; // ViewChild reference
      if (!diffComp) return;

      this.defineMonacoTheme();
      this.applyMonacoTheme(this.getMonacoTheme());

      // if the wrapper offers a setModel API:
      if (typeof diffComp.setModel === 'function') {
        diffComp.setModel({
          original: {
            value: this.originalModel.code,
            language: this.originalModel.language,
            tabSize: 4,
            insertSpaces: true,
          },
          modified: {
            value: this.modifiedModel.code,
            language: this.modifiedModel.language,
            tabSize: 4,
            insertSpaces: true,
          },
        });
      } else {
        // fallback: set the bound inputs (Angular detects changes)
        // nothing else required
      }

      // get the internal Monaco diff editor instance
      const monacoDiffEditor = diffComp.getDiffEditor ? diffComp.getDiffEditor() : diffComp._editor;
      if (monacoDiffEditor) {
        this.configureDiffEditor(monacoDiffEditor);
        // lineChanges contains hunks info (ILineChange[])
        const lineChanges = monacoDiffEditor.getLineChanges();
        console.log('lineChanges/hunks:', lineChanges);
      }

      if (monacoDiffEditor && monacoDiffEditor.getModifiedEditor) {
        const originalEditor = monacoDiffEditor.getOriginalEditor();
        if (originalEditor) {
          originalEditor.onDidChangeModelContent(() => {
            const value = originalEditor.getModel().getValue();
            this.originalModel.length = value.length;
            this.originalModel.code = value;
            // trigger change detection if needed
            this.ngZone.run(() => {});
          });
      }
        const modifiedEditor = monacoDiffEditor.getModifiedEditor();
        if (modifiedEditor) {
          modifiedEditor.onDidChangeModelContent(() => {
            const value = modifiedEditor.getModel().getValue();
            this.modifiedModel.length = value.length;
            this.modifiedModel.code = value;
            this.ngZone.run(() => {});
          });
        }
        // clear previous decorations stored in a property
        (modifiedEditor as any).__myDecos = (modifiedEditor as any).__myDecos || [];
        (modifiedEditor as any).__myDecos = modifiedEditor.deltaDecorations(
          (modifiedEditor as any).__myDecos,
          [
            {
              range: new (window as any).monaco.Range(1, 1, 1, 120),
              options: { isWholeLine: true }
            }
          ]
        );
      }
    } catch (err) {
      console.warn('applyModelsToEditor error', err);
    }
  }

  getModifiedText(): string {
    try {
      const diffComp = this.diffEditorComponent;
      const monacoDiffEditor = diffComp.getDiffEditor ? diffComp.getDiffEditor() : diffComp._editor;
      const modifiedEditor = monacoDiffEditor?.getModifiedEditor();
      return modifiedEditor ? modifiedEditor.getModel().getValue() : this.modifiedModel.code;
    } catch {
      return this.modifiedModel.code;
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
        'diffEditor.insertedTextBackground': '#34445466',
        'diffEditor.removedTextBackground': '#34445466',
        'diffEditor.insertedLineBackground': '#34445444',
        'diffEditor.removedLineBackground': '#34445444',
      },
    });
  }

  onDiffEditorInit(diffEditor: any): void {
    this.configureDiffEditor(diffEditor);
  }

  private applyMonacoTheme(theme: string): void {
    (window as any).monaco?.editor?.setTheme(theme);
  }

  private toMonacoColor(color: string): string {
    return color.trim();
  }

  private configureDiffEditor(diffEditor: any): void {
    diffEditor.updateOptions?.({
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
    });
    this.configureEditor(diffEditor.getOriginalEditor?.());
    this.configureEditor(diffEditor.getModifiedEditor?.());
  }

  private configureEditor(editor: any): void {
    if (!editor) {
      return;
    }

    if (editor.__differEditorConfigured) {
      return;
    }

    editor.__differEditorConfigured = true;
    editor.updateOptions({
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
    });
    editor.getModel()?.updateOptions({ tabSize: 4, insertSpaces: true });
  }
    
  toggleClearMenu() {
    this.isClearMenuExpanded = !this.isClearMenuExpanded;
  }

  toggleEditingOriginalTitle() {
    this.isEditingOriginalTitle = !this.isEditingOriginalTitle;
  }

  toggleEditingModifiedTitle() {
    this.isEditingModifiedTitle = !this.isEditingModifiedTitle;
  }

  onOriginalTitleClickOutside() {
    this.isEditingOriginalTitle = false;
    this.toggleOriginalTitleHovered(false);
  }

  onModifiedTitleClickOutside() {
    this.isEditingModifiedTitle = false;
    this.toggleModifiedTitleHovered(false);
  }

  toggleOriginalTitleHovered(isHovered: boolean) {
    this.isOriginalTitleHovered = isHovered;
  }

  toggleModifiedTitleHovered(isHovered: boolean) {
    this.isModifiedTitleHovered = isHovered;
  }

  ngOnDestroy() {
    this.update$.complete();
    this.destroy$.next(void 0);
    this.destroy$.complete();
  }
}
