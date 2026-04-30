import { Location } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import {
  Friend,
  FriendsPull,
  PendingFriendRequest,
} from '../../services/friends-pull';

interface CommunityFriendViewModel {
  id: string;
  username: string;
  initials: string;
  isConnected: boolean;
}

interface PendingFriendRequestViewModel {
  id: string;
  fromUserId: string;
  fromUsername: string;
  createdAt: string;
  createdAtLabel: string;
  initials: string;
}

@Component({
  selector: 'app-navigation-bar',
  standalone: true,
  imports: [RouterLink],
  template: `
        <header class="store-navbar">
      <a class="brand" [routerLink]="brandRoute()" [attr.aria-label]="brandAriaLabel()">
        A Tale of Recognition
      </a>

      <nav class="quick-actions" aria-label="Acciones rapidas">
        @if (showsBackButton()) {
          <button type="button" class="icon-button back-button" aria-label="Volver a la pagina anterior" (click)="goBack()">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 5.5L8 12l6.5 6.5" />
              <path d="M9 12h10" />
            </svg>
          </button>
        }

        @if (!isStorePage()) {
          <a routerLink="/store" class="icon-button store-button" aria-label="Ir a tienda">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 8h12l-1.2 11H7.2L6 8Z" />
              <path d="M9 8V6.8A3 3 0 0 1 12 4a3 3 0 0 1 3 2.8V8" />
            </svg>
          </a>
        }

        <button
          type="button"
          class="icon-button"
          aria-label="Comunidad"
          [attr.aria-expanded]="communityOpen"
          (click)="switchCommunityPanel()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M8 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M3 19a4 4 0 0 1 8 0" />
            <path d="M13 19a4 4 0 0 1 8 0" />
          </svg>
        </button>

        <a routerLink="/profile" class="icon-button" aria-label="Perfil">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 19a7 7 0 0 1 14 0" />
          </svg>
        </a>

        @if (!isSettingsPage()) {
          <a routerLink="/settings" class="icon-button" aria-label="Ir a ajustes">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
              <path
                d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4.8a7.2 7.2 0 0 0-1.9-1.1L14.2 3h-4.4l-.4 2.7a7.2 7.2 0 0 0-1.9 1.1L5.1 6l-2 3.4 2 1.5a7 7 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-.8a7.2 7.2 0 0 0 1.9 1.1l.4 2.7h4.4l.4-2.7a7.2 7.2 0 0 0 1.9-1.1l2.4.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.1Z"
              />
            </svg>
          </a>
        }
      </nav>
    </header>

    @if (communityOpen) {
      <aside class="community-panel" aria-label="Panel de comunidad">
        <div class="community-header">
          <h2>SOCIAL</h2>
          <button
            type="button"
            class="search-placeholder"
            aria-label="Mostrar formulario para enviar solicitudes de amistad"
            [attr.aria-expanded]="searchOpen"
            (click)="switchSearchBox()">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l5 5" />
            </svg>
          </button>
        </div>

        @if (searchOpen) {
          <div class="friend-request-form">
            <div class="friend-request-field">
              <input
                type="text"
                placeholder="ID del usuario (u_...)"
                class="community-search-input"
                [value]="friendTargetUserId"
                (input)="updateFriendTargetUserId($event)" />
              @if (friendRequestError) {
                <p class="friend-request-error">{{ friendRequestError }}</p>
              }
            </div>
            <button
              type="button"
              class="action-placeholder"
              [disabled]="sendingFriendRequest || friendTargetUserId.trim().length === 0"
              (click)="sendFriendRequest()">
              {{ sendingFriendRequest ? 'Enviando...' : 'Enviar solicitud' }}
            </button>
          </div>
        }

        @if (communityError) {
          <p class="community-feedback error">{{ communityError }}</p>
        }

        @if (communityMessage) {
          <p class="community-feedback">{{ communityMessage }}</p>
        }

        @if (friendsLoading) {
          <p class="community-status">Cargando amigos...</p>
        } @else {
          <p class="community-section">SOLICITUDES PENDIENTES</p>
          @if (pendingRequests.length === 0) {
            <p class="community-status">No tienes solicitudes pendientes.</p>
          } @else {
            @for (request of pendingRequests; track request.id) {
              <article class="player-card pending-card">
                <div class="avatar">{{ request.initials }}</div>
                <div class="player-meta">
                  <p class="player-name">{{ request.fromUsername }}</p>
                  <p class="player-status">ID: {{ request.fromUserId }}</p>
                  <p class="player-status">Recibida: {{ request.createdAtLabel }}</p>
                </div>
                <div class="card-actions">
                  <button
                    type="button"
                    class="action-placeholder"
                    [disabled]="isRequestBusy(request.id)"
                    (click)="respondToFriendRequest(request.id, 'accept')">
                    Aceptar
                  </button>
                  <button
                    type="button"
                    class="action-placeholder secondary"
                    [disabled]="isRequestBusy(request.id)"
                    (click)="respondToFriendRequest(request.id, 'reject')">
                    Rechazar
                  </button>
                </div>
              </article>
            }
          }

          <p class="community-section">CONECTADOS</p>
          @if (connectedPlayers.length === 0) {
            <p class="community-status">No hay amigos conectados.</p>
          } @else {
            @for (player of connectedPlayers; track player.id) {
              <article class="player-card">
                <div class="avatar">{{ player.initials }}</div>
                <div class="player-meta">
                  <p class="player-name">{{ player.username }}</p>
                </div>
                <button
                  type="button"
                  class="action-placeholder"
                  [disabled]="isFriendBusy(player.id)"
                  (click)="removeFriend(player.id)">
                  Eliminar
                </button>
              </article>
            }
          }

          <p class="community-section">DESCONECTADOS</p>
          @if (disconnectedPlayers.length === 0) {
            <p class="community-status">No hay amigos desconectados.</p>
          } @else {
            @for (player of disconnectedPlayers; track player.id) {
              <article class="player-card">
                <div class="avatar offline">{{ player.initials }}</div>
                <div class="player-meta">
                  <p class="player-name">{{ player.username }}</p>
                </div>
                <button
                  type="button"
                  class="action-placeholder"
                  [disabled]="isFriendBusy(player.id)"
                  (click)="removeFriend(player.id)">
                  Eliminar
                </button>
              </article>
            }
          }
        }
      </aside>
    }
  `,
  styleUrl: './navigation-bar.css',
})
export class NavigationBar {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly auth = inject(Auth);
  private readonly friendsPull = inject(FriendsPull);
  private readonly cdr = inject(ChangeDetectorRef);
  communityOpen = false;
  searchOpen = false;
  friendsLoading = false;
  communityError = '';
  communityMessage = '';
  friendRequestError = '';
  sendingFriendRequest = false;
  friendTargetUserId = '';
  connectedPlayers: CommunityFriendViewModel[] = [];
  disconnectedPlayers: CommunityFriendViewModel[] = [];
  pendingRequests: PendingFriendRequestViewModel[] = [];
  private readonly busyRequestIds = new Set<string>();
  private readonly busyFriendIds = new Set<string>();

  isStorePage(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/store';
  }

  isSettingsPage(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/settings';
  }

  isDeckBuilderPage(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/deck-builder';
  }

  showsBackButton(): boolean {
    return this.isSettingsPage() || this.isDeckBuilderPage();
  }

  brandRoute(): string {
    return this.auth.activeGameRoute() ?? '/menu';
  }

  brandAriaLabel(): string {
    return this.auth.activeGameId()
      ? 'Volver a la partida activa'
      : 'Ir al menu principal';
  }

  switchCommunityPanel(): void {
    this.communityOpen = !this.communityOpen;
    if (!this.communityOpen) {
      this.searchOpen = false;
      this.communityError = '';
      this.communityMessage = '';
      this.friendRequestError = '';
      this.cdr.detectChanges();
      return;
    }

    this.cdr.detectChanges();
    setTimeout(() => {
      void this.loadCommunityData(true);
    }, 0);
  }

  switchSearchBox(): void {
    this.searchOpen = !this.searchOpen;
    this.communityError = '';
    this.communityMessage = '';
    this.friendRequestError = '';
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl(this.brandRoute());
  }

  updateFriendTargetUserId(event: Event): void {
    this.friendTargetUserId = (event.target as HTMLInputElement).value;
    if (this.friendRequestError) {
      this.friendRequestError = '';
    }
  }

  async sendFriendRequest(): Promise<void> {
    const targetUserId = this.friendTargetUserId.trim();
    if (!targetUserId || this.sendingFriendRequest) {
      return;
    }

    this.communityMessage = '';
    this.friendRequestError = '';
    this.sendingFriendRequest = true;

    try {
      this.communityMessage = await this.friendsPull.sendFriendRequest(targetUserId);
      this.friendTargetUserId = '';
      await this.loadCommunityData(true);
    } catch (error) {
      this.friendRequestError =
        error instanceof Error ? error.message : 'No se pudo enviar la solicitud';
    } finally {
      this.sendingFriendRequest = false;
      this.cdr.detectChanges();
    }
  }

  async respondToFriendRequest(
    requestId: string,
    action: 'accept' | 'reject'
  ): Promise<void> {
    if (this.busyRequestIds.has(requestId)) {
      return;
    }

    this.busyRequestIds.add(requestId);
    this.communityError = '';
    this.communityMessage = '';

    try {
      this.communityMessage = await this.friendsPull.respondToFriendRequest(requestId, action);
      await this.loadCommunityData(true);
    } catch (error) {
      this.communityError =
        error instanceof Error ? error.message : 'No se pudo procesar la solicitud';
    } finally {
      this.busyRequestIds.delete(requestId);
      this.cdr.detectChanges();
    }
  }

  async removeFriend(friendId: string): Promise<void> {
    if (this.busyFriendIds.has(friendId)) {
      return;
    }

    this.busyFriendIds.add(friendId);
    this.communityError = '';
    this.communityMessage = '';

    try {
      this.communityMessage = await this.friendsPull.removeFriend(friendId);
      await this.loadCommunityData(true);
    } catch (error) {
      this.communityError =
        error instanceof Error ? error.message : 'No se pudo eliminar al amigo';
    } finally {
      this.busyFriendIds.delete(friendId);
      this.cdr.detectChanges();
    }
  }

  isRequestBusy(requestId: string): boolean {
    return this.busyRequestIds.has(requestId);
  }

  isFriendBusy(friendId: string): boolean {
    return this.busyFriendIds.has(friendId);
  }

  private async loadCommunityData(forceRefresh = false): Promise<void> {
    if (this.friendsLoading) {
      return;
    }

    this.friendsLoading = true;
    this.communityError = '';
    this.cdr.detectChanges();

    try {
      const { friends, pendingRequests } = await this.friendsPull.getFriendsPanelData({
        forceRefresh,
      });
      const friendViewModels = friends.map((friend) => this.toFriendViewModel(friend));
      this.connectedPlayers = friendViewModels.filter((friend) => friend.isConnected);
      this.disconnectedPlayers = friendViewModels.filter((friend) => !friend.isConnected);
      this.pendingRequests = pendingRequests.map((request) =>
        this.toPendingRequestViewModel(request)
      );
    } catch (error) {
      this.communityError =
        error instanceof Error ? error.message : 'No se pudieron cargar los amigos';
      this.connectedPlayers = [];
      this.disconnectedPlayers = [];
      this.pendingRequests = [];
    } finally {
      this.friendsLoading = false;
      this.cdr.detectChanges();
    }
  }

  private toFriendViewModel(friend: Friend): CommunityFriendViewModel {
    return {
      id: friend.id,
      username: friend.username,
      initials: this.buildInitials(friend.username),
      isConnected: this.isConnectedStatus(friend.status),
    };
  }

  private toPendingRequestViewModel(
    request: PendingFriendRequest
  ): PendingFriendRequestViewModel {
    return {
      id: request.id,
      fromUserId: request.fromUserId,
      fromUsername: request.fromUsername,
      createdAt: request.createdAt,
      createdAtLabel: this.formatDate(request.createdAt),
      initials: this.buildInitials(request.fromUsername),
    };
  }

  private buildInitials(username: string): string {
    const compact = username.trim();
    if (compact.length === 0) {
      return '--';
    }

    return compact.slice(0, 2).toUpperCase();
  }

  private isConnectedStatus(status: string): boolean {
    switch (status.trim().toUpperCase()) {
      case 'CONNECTED':
      case 'ONLINE':
      case 'AWAY':
      case 'BUSY':
        return true;
      case 'DISCONNECTED':
      case 'UNKNOWN':
      case 'OFFLINE':
      default:
        return false;
    }
  }

  private formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
