import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavigationBar } from './navigation-bar';
import { Auth } from '../../services/auth';
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
        { provide: Auth, useValue: { activeGameId: () => null, activeGameRoute: () => null } },
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

  it('treats CONNECTED friends as connected', async () => {
    friendsPullSpy.getFriendsPanelData.and.resolveTo({
      friends: [{ id: 'u_7', username: 'Jugador7', status: 'CONNECTED' }],
      pendingRequests: [],
    });

    component.switchCommunityPanel();
    await fixture.whenStable();

    expect(component.connectedPlayers.length).toBe(1);
    expect(component.disconnectedPlayers.length).toBe(0);
    expect(component.connectedPlayers[0]?.username).toBe('Jugador7');
  });

  it('treats UNKNOWN friends as disconnected', async () => {
    friendsPullSpy.getFriendsPanelData.and.resolveTo({
      friends: [{ id: 'u_2', username: 'Jugador2', status: 'UNKNOWN' }],
      pendingRequests: [],
    });

    component.switchCommunityPanel();
    await fixture.whenStable();

    expect(component.connectedPlayers.length).toBe(0);
    expect(component.disconnectedPlayers.length).toBe(1);
    expect(component.disconnectedPlayers[0]?.username).toBe('Jugador2');
  });

  it('does not render the friend status text inside each card', async () => {
    friendsPullSpy.getFriendsPanelData.and.resolveTo({
      friends: [{ id: 'u_7', username: 'Jugador7', status: 'CONNECTED' }],
      pendingRequests: [],
    });

    component.switchCommunityPanel();
    await fixture.whenStable();
    fixture.detectChanges();

    const friendStatuses = fixture.nativeElement.querySelectorAll('.player-card .player-status');
    expect(friendStatuses.length).toBe(0);
  });

  it('shows the API error below the user id input when sending a request fails', async () => {
    friendsPullSpy.sendFriendRequest.and.rejectWith(new Error('Usuario no encontrado'));

    component.switchCommunityPanel();
    component.switchSearchBox();
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('.community-search-input');
    input.value = 'u_999';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.friend-request-form .action-placeholder'
    );
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorMessage: HTMLElement | null =
      fixture.nativeElement.querySelector('.friend-request-error');

    expect(errorMessage?.textContent?.trim()).toBe('Usuario no encontrado');
  });
});
