import { Location } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  Friend,
  FriendsPull,
  PendingFriendRequest,
} from '../../services/friends-pull';

interface CommunityFriendViewModel {
  id: string;
  username: string;
  status: string;
  initials: string;
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
      <a class="brand" routerLink="/games" aria-label="Ir al menu principal">
        A Tale of Recognition
      </a>

      <nav class="quick-actions" aria-label="Acciones rapidas">
        @if (isSettingsPage()) {
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
            <input
              type="text"
              placeholder="ID del usuario (u_...)"
              class="community-search-input"
              [value]="friendTargetUserId"
              (input)="updateFriendTargetUserId($event)" />
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
                  <p class="player-status">{{ player.status }}</p>
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
                  <p class="player-status">{{ player.status }}</p>
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
  styles: `
    :host {
      --navbar-height: 72px;
      display: block;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .store-navbar {
      height: var(--navbar-height);
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(180deg, rgba(14, 40, 62, 0.68), rgba(10, 31, 50, 0.62));
      border-bottom: 1px solid rgba(232, 217, 168, 0.42);
      box-shadow: 0 8px 20px rgba(2, 6, 12, 0.35);
      backdrop-filter: blur(4px);
    }

    .brand {
      text-decoration: none;
      color: #e2cc93;
      font-family: 'FuenteDilana', serif;
      font-size: clamp(2rem, 3.05vw, 2.7rem);
      letter-spacing: 1px;
      line-height: 1;
      -webkit-text-stroke: 0.65px #2b2009;
      text-shadow: 0 2px 3px rgba(0, 0, 0, 0.42);
      padding: 6px 12px 8px;
    }

    .quick-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon-button {
      width: 42px;
      height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1.5px solid rgba(232, 217, 168, 0.88);
      background: rgba(5, 24, 38, 0.35);
      color: #e8d9a8;
      cursor: pointer;
      transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
    }

    .store-button {
      border-radius: 8px;
      width: 44px;
      height: 34px;
      margin-right: 4px;
    }

    .back-button {
      width: 66px;
      height: 40px;
      border-radius: 8px;
      margin-right: 14px;
      margin-left: 4px;
    }

    .back-button svg {
      width: 24px;
      height: 24px;
    }

    .icon-button svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .icon-button:hover {
      transform: translateY(-1px);
      background: rgba(16, 53, 76, 0.42);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
    }

    .community-panel {
      position: fixed;
      top: var(--navbar-height);
      right: 0;
      width: min(560px, 94vw);
      height: calc(100dvh - var(--navbar-height));
      padding: 20px 18px 24px;
      box-sizing: border-box;
      background: linear-gradient(180deg, rgba(3, 24, 40, 0.94), rgba(2, 18, 30, 0.92));
      border-left: 1px solid rgba(232, 217, 168, 0.35);
      box-shadow: -10px 0 28px rgba(0, 0, 0, 0.28);
      overflow-y: auto;
      z-index: 19;
    }

    .community-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .community-header h2 {
      margin: 0;
      color: #e8d9a8;
      font-size: 2rem;
      letter-spacing: 1px;
      font-weight: 500;
    }

    .search-placeholder {
      width: 42px;
      height: 42px;
      border: none;
      background: transparent;
      color: #e8d9a8;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .search-placeholder svg {
      width: 30px;
      height: 30px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .community-section {
      margin: 18px 0 10px;
      color: #e8d9a8;
      font-weight: 700;
      letter-spacing: 0.6px;
    }

    .community-search-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(232, 217, 168, 0.4);
      border-radius: 10px;
      background: rgba(8, 29, 45, 0.86);
      color: #e9f1f7;
      padding: 10px 12px;
      font-size: 1rem;
      outline: none;
      margin: 0 0 14px;
    }

    .community-search-input::placeholder {
      color: rgba(233, 241, 247, 0.7);
    }

    .friend-request-form {
      display: flex;
      gap: 10px;
      align-items: center;
      margin: 0 0 14px;
    }

    .community-feedback {
      margin: 0 0 12px;
      color: #c7f0d8;
      font-size: 0.95rem;
    }

    .community-feedback.error {
      color: #ffb7b7;
    }

    .community-status {
      margin: 0 0 12px;
      color: #d8e5ee;
      font-size: 0.96rem;
    }

    .player-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(54, 124, 178, 0.72);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }

    .pending-card {
      align-items: flex-start;
    }

    .avatar {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(145deg, #4aa2ff, #254d87);
      color: #ffffff;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar.offline {
      background: linear-gradient(145deg, #8897a8, #4e5867);
    }

    .player-meta {
      min-width: 0;
      flex: 1;
    }

    .player-name {
      margin: 0;
      color: #07131d;
      font-weight: 700;
      font-size: 1.05rem;
    }

    .player-status {
      margin: 2px 0 0;
      color: #f4e7ba;
      font-size: 0.96rem;
    }

    .action-placeholder {
      border: 1.5px solid rgba(30, 54, 62, 0.45);
      background: rgba(196, 223, 212, 0.88);
      color: #11242a;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 1rem;
      white-space: nowrap;
      cursor: pointer;
    }

    .action-placeholder.secondary {
      background: rgba(228, 202, 196, 0.92);
    }

    .action-placeholder:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .card-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    @media (max-width: 720px) {
      .store-navbar {
        padding: 0 12px;
      }

      .brand {
        font-size: 1.4rem;
        max-width: 48vw;
      }

      .quick-actions {
        gap: 8px;
      }

      .icon-button {
        width: 36px;
        height: 36px;
      }

      .store-button {
        width: 40px;
        height: 30px;
      }

      .back-button {
        width: 58px;
        height: 36px;
        margin-right: 10px;
      }

      .back-button svg {
        width: 20px;
        height: 20px;
      }

      .icon-button svg {
        width: 16px;
        height: 16px;
      }

      .community-panel {
        width: 100vw;
        padding: 16px 12px 20px;
      }

      .community-header h2 {
        font-size: 1.7rem;
      }

      .player-card {
        gap: 10px;
        padding: 9px 10px;
      }

      .avatar {
        width: 50px;
        height: 50px;
      }

      .action-placeholder {
        font-size: 0.9rem;
        padding: 5px 10px;
      }

      .friend-request-form {
        flex-direction: column;
        align-items: stretch;
      }

      .card-actions {
        width: 100%;
      }
    }
  `,
})
export class NavigationBar {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly friendsPull = inject(FriendsPull);
  private readonly cdr = inject(ChangeDetectorRef);
  communityOpen = false;
  searchOpen = false;
  friendsLoading = false;
  communityError = '';
  communityMessage = '';
  sendingFriendRequest = false;
  friendTargetUserId = '';
  connectedPlayers: CommunityFriendViewModel[] = [];
  disconnectedPlayers: CommunityFriendViewModel[] = [];
  pendingRequests: PendingFriendRequestViewModel[] = [];
  private hasLoadedCommunityData = false;
  private readonly busyRequestIds = new Set<string>();
  private readonly busyFriendIds = new Set<string>();

  isStorePage(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/store';
  }

  isSettingsPage(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/settings';
  }

  switchCommunityPanel(): void {
    this.communityOpen = !this.communityOpen;
    if (!this.communityOpen) {
      this.searchOpen = false;
      this.communityError = '';
      this.communityMessage = '';
      this.cdr.detectChanges();
      return;
    }

    if (!this.hasLoadedCommunityData) {
      this.cdr.detectChanges();
      setTimeout(() => {
        void this.loadCommunityData();
      }, 0);
    }
  }

  switchSearchBox(): void {
    this.searchOpen = !this.searchOpen;
    this.communityError = '';
    this.communityMessage = '';
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigateByUrl('/main-menu');
  }

  updateFriendTargetUserId(event: Event): void {
    this.friendTargetUserId = (event.target as HTMLInputElement).value;
  }

  async sendFriendRequest(): Promise<void> {
    const targetUserId = this.friendTargetUserId.trim();
    if (!targetUserId || this.sendingFriendRequest) {
      return;
    }

    this.communityError = '';
    this.communityMessage = '';
    this.sendingFriendRequest = true;

    try {
      this.communityMessage = await this.friendsPull.sendFriendRequest(targetUserId);
      this.friendTargetUserId = '';
      await this.loadCommunityData(true);
    } catch (error) {
      this.communityError =
        error instanceof Error ? error.message : 'No se pudo enviar la solicitud';
    } finally {
      this.sendingFriendRequest = false;
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
      this.connectedPlayers = friendViewModels.filter((friend) => this.isOnline(friend.status));
      this.disconnectedPlayers = friendViewModels.filter(
        (friend) => !this.isOnline(friend.status)
      );
      this.pendingRequests = pendingRequests.map((request) =>
        this.toPendingRequestViewModel(request)
      );
      this.hasLoadedCommunityData = true;
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
      status: this.translateStatus(friend.status),
      initials: this.buildInitials(friend.username),
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

  private translateStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'online':
        return 'conectado';
      case 'offline':
        return 'desconectado';
      default:
        return status;
    }
  }

  private isOnline(status: string): boolean {
    return status.toLowerCase() === 'conectado';
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
