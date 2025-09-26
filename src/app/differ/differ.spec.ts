import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Differ } from './differ';

describe('Differ', () => {
  let component: Differ;
  let fixture: ComponentFixture<Differ>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Differ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Differ);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
