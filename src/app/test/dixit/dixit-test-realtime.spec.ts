import { TestBed } from '@angular/core/testing';

import { DixitRealtimeSimulator } from './dixit-test-realtime';

describe('DixitRealtimeSimulator', () => {
  let service: DixitRealtimeSimulator;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DixitRealtimeSimulator],
    });

    service = TestBed.inject(DixitRealtimeSimulator);
  });

  it('connects a sandbox lobby and exposes the initial hand snapshot', async () => {
    await service.ensureLobbyConnection('sandbox-9');

    expect(service.connectionStatus()).toBe('connected');
    expect(service.activeLobbyCode()).toBe('SANDBOX-9');
    expect(service.lobbyState()?.players.length).toBe(4);
    expect(service.privateHand()?.hand.length).toBe(6);
    expect(service.gameState()?.state['phase']).toBe('HAND');
  });

  it('opens the voting phase after sending the story from the local player', async () => {
    await service.ensureLobbyConnection('sandbox-9');

    service.sendGameAction('SEND_STORY', {
      cardId: 'c_101',
      clue: 'Pista de prueba',
    });

    expect(service.gameState()?.state['phase']).toBe('VOTING');
    expect(service.simulatorSnapshot()?.clue).toBe('Pista de prueba');
    expect(service.simulatorSnapshot()?.boardCards.length).toBeGreaterThan(1);
  });

  it('publishes star rewards and final ranking in the simulated websocket flow', async () => {
    await service.ensureLobbyConnection('sandbox-9');

    service.spawnStar();
    service.resolveStarClaim('u_teo');
    service.finishGame();

    expect(service.starClaim()?.winnerId).toBe('u_teo');
    expect(service.starClaim()?.newScores['u_teo']).toBeGreaterThan(0);
    expect(service.gameEndedResult()?.ranking.length).toBe(4);
    expect(service.walletUpdated()?.balance).toBeGreaterThan(250);
  });

  it('can publish a HAND_LIMIT modifier in the simulated game state', async () => {
    await service.ensureLobbyConnection('sandbox-9');

    service.setHandLimitModifier(1, 3);

    expect(service.gameState()?.state['activeModifiers']).toEqual({
      hand_limit: {
        type: 'HAND_LIMIT',
        value: 1,
        turnsLeft: 3,
      },
    });
    expect(service.simulatorSnapshot()?.activeModifiers).toEqual({
      hand_limit: {
        type: 'HAND_LIMIT',
        value: 1,
        turnsLeft: 3,
      },
    });
  });
});
