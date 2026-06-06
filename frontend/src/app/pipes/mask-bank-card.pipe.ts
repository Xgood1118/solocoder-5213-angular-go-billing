import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'maskBankCard'
})
export class MaskBankCardPipe implements PipeTransform {

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value.length < 4) {
      return value;
    }
    return '**** **** **** ' + value.slice(-4);
  }

}
