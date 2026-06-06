import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fenToYuan'
})
export class FenToYuanPipe implements PipeTransform {

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '0.00';
    }
    
    const fen = Math.round(value);
    const yuan = Math.floor(Math.abs(fen) / 100);
    const cents = Math.abs(fen) % 100;
    const sign = fen < 0 ? '-' : '';
    
    return `${sign}${yuan}.${cents.toString().padStart(2, '0')}`;
  }

}
