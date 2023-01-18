import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KoreaOrders } from 'src/entities/korea-orders.entity';
import { Between, Repository } from 'typeorm';

@Injectable()
export class KoreaService {
  constructor(
    @InjectRepository(KoreaOrders)
    private koreaOrdersRepository: Repository<KoreaOrders>,
  ) {}

  async getSales(sales): Promise<KoreaOrders[]> {
    const { today, type } = sales;

    if (type === '1') {
      const salesData = await this.koreaOrdersRepository
        .createQueryBuilder('koreaOrders')
        .select(
          'SUM(koreaOrders.sale_price) - SUM(koreaOrders.discount_price)',
          'sales_price',
        )
        .addSelect('COUNT(DISTINCT(koreaOrders.id))', 'order_count')
        .where('DATE(koreaOrders.payment_date) = :today', { today: today })
        .andWhere('koreaOrders.status_id IN (:...ids)', {
          ids: ['p1', 'g1', 'd1', 'd2', 's1'],
        })
        .groupBy('DATE(koreaOrders.payment_date)')
        .getRawOne();
      if (!salesData) {
        throw new NotFoundException(`can't find today's sales datas`);
      }
      return salesData;
    }
    if (type === '10') {
      const todayDate = new Date(today);
      const beforeDate = new Date(todayDate.getTime());
      beforeDate.setDate(todayDate.getDate() - 10);
      const beforeDay =
        beforeDate.getFullYear +
        '-' +
        beforeDate.getMonth +
        '-' +
        beforeDate.getDate;

      const salesData = await this.koreaOrdersRepository
        .createQueryBuilder('koreaOrders')
        .select(
          'SUM(koreaOrders.sale_price) - SUM(koreaOrders.discount_price)',
          'sales_price',
        )
        .where('DATE(koreaOrders.payment_date) < :today', { today: today })
        .andWhere('DATE(koreaOrders.payment_date) => :beforeDay', {
          beforeDay: beforeDay,
        })
        .andWhere('koreaOrders.status_id IN (:...ids)', {
          ids: ['p1', 'g1', 'd1', 'd2', 's1'],
        })
        .groupBy('DATE(koreaOrders.payment_date)')
        .getRawMany();
      if (!salesData) {
        throw new NotFoundException(`can't find today's sales datas`);
      }
      return salesData;
    }
  }
}
