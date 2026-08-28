import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Indenter } from './indenter';

describe('Indenter', () => {
  let component: Indenter;
  let fixture: ComponentFixture<Indenter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Indenter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Indenter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
