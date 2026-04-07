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
  templateUrl: './navigation-bar.html',
  styleUrl: './navigation-bar.css',
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
