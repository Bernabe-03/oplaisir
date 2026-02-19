import { Injectable } from '@nestjs/common';

@Injectable()
export class SoundsService {
  private soundFiles = {
    'order-notification': {
      file: 'order-notification.mp3',
      duration: 3000,
      volume: 0.7,
    },
    'pending-alert': {
      file: 'pending-alert.mp3',
      duration: 2000,
      volume: 0.5,
    },
    'stock-alert': {
      file: 'stock-alert.mp3',
      duration: 2500,
      volume: 0.6,
    },
    'success': {
      file: 'success-notification.mp3',
      duration: 1500,
      volume: 0.4,
    },
    'warning': {
      file: 'warning-alert.mp3',
      duration: 2000,
      volume: 0.8,
    },
  };

  getSoundConfig(type: keyof typeof this.soundFiles) {
    return this.soundFiles[type] || this.soundFiles['order-notification'];
  }

  generateNotificationSound(type: string, count?: number): any {
    // Vérifier si le type existe dans soundFiles
    if (type in this.soundFiles) {
      const baseSound = this.getSoundConfig(type as keyof typeof this.soundFiles);
      
      // Personnaliser le son en fonction du nombre de commandes en attente
      if (type === 'pending-alert' && count) {
        return {
          ...baseSound,
          repeat: count > 3 ? 2 : 1,
          volume: count > 5 ? 0.8 : baseSound.volume,
        };
      }
      
      return baseSound;
    }
    
    // Retourner un son par défaut si le type n'existe pas
    return this.soundFiles['order-notification'];
  }
}