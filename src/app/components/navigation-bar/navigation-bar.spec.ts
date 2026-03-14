import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NavigationBar } from './navigation-bar';
import { FriendsPull } from '../../services/friends-pull';

describe('NavigationBar', () => {
  let component: NavigationBar;
  let fixture: ComponentFixture<NavigationBar>;
  let friendsPullSpy: jasmine.SpyObj<FriendsPull>;

  beforeEach(async () => {
    friendsPullSpy = jasmine.createSpyObj<FriendsPull>('FriendsPull', [
      'getFriendsPanelData',
      'sendFriendRequest',
      'respondToFriendRequest',
      'removeFriend',
    ]);
    friendsPullSpy.getFriendsPanelData.and.resolveTo({
      friends: [
        { id: 'u_1', username: 'Alpha', status: 'online' },
        { id: 'u_2', username: 'Beta', status: 'offline' },
      ],
      pendingRequests: [
        {
          id: 'req_1',
          fromUserId: 'u_3',
          fromUsername: 'Gamma',
          createdAt: '2026-03-01T10:00:00Z',
        },
      ],
    });

    await TestBed.configureTestingModule({
      imports: [NavigationBar],
      providers: [
        provideRouter([]),
        { provide: FriendsPull, useValue: friendsPullSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads friends when opening the community panel', async () => {
    component.switchCommunityPanel();
    await fixture.whenStable();

    expect(friendsPullSpy.getFriendsPanelData).toHaveBeenCalledTimes(1);
    expect(component.connectedPlayers.length).toBe(1);
    expect(component.disconnectedPlayers.length).toBe(1);
    expect(component.pendingRequests.length).toBe(1);
  });
});
