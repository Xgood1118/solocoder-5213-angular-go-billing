import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'maskIDCard'
})
export class MaskIDCardPipe implements PipeTransform {

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value.length < 10) {
      return value;
    }
    return value.slice(0, 6) + '********' + value.slice(-4);
  }

}
