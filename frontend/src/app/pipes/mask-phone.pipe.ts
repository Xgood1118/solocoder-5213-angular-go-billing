import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'maskPhone'
})
export class MaskPhonePipe implements PipeTransform {

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value.length < 11) {
      return value;
    }
    return value.slice(0, 3) + '****' + value.slice(-4);
  }

}
