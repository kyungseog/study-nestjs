import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KoreaOrders } from 'src/entities/korea-orders.entity';
import { Products } from 'src/entities/products.entity';
import { Brands } from 'src/entities/brands.entity';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { KoreaUsers } from 'src/entities/korea-users.entity';
import { KoreaMarketing } from 'src/entities/korea-marketing.entity';
import { Suppliers } from 'src/entities/suppliers.entity';
import { Costs } from 'src/entities/costs.entity';
import { KoreaBudget } from 'src/entities/korea-budget.entity';
import { Squads } from 'src/entities/squads.entity';

@Injectable()
export class KoreaService {
  constructor(
    @InjectRepository(KoreaOrders)
    private koreaOrdersRepository: Repository<KoreaOrders>,
    @InjectRepository(KoreaBudget)
    private koreaBudgetRepository: Repository<KoreaBudget>,
    @InjectRepository(KoreaUsers)
    private koreaUsersRepository: Repository<KoreaUsers>,
    @InjectRepository(KoreaMarketing)
    private koreaMarketingRepository: Repository<KoreaMarketing>,
  ) {}

  async getSales(): Promise<KoreaOrders[]> {
    const today = DateTime.now().toFormat('yyyy-LL-dd');
    const thisYearMonth = DateTime.now().toFormat('yyyy-LL');
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd');
    const todayData = await this.koreaOrdersRepository
      .createQueryBuilder()
      .select('SUM((sale_price - discount_price) * quantity)', 'sales_price')
      .addSelect('COUNT(DISTINCT(id))', 'order_count')
      .where('payment_date BETWEEN :today AND :tomorrow', {
        today: today,
        tomorrow: tomorrow,
      })
      .andWhere('status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('user_id != "mmzjapan"')
      .getRawMany();
    const monthlyData = await this.koreaOrdersRepository
      .createQueryBuilder()
      .select('SUM((sale_price - discount_price) * quantity)', 'sales_price')
      .where('payment_date BETWEEN :firstDay AND :tomorrow', {
        firstDay: thisYearMonth + '-01',
        tomorrow: tomorrow,
      })
      .andWhere('status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('user_id != "mmzjapan"')
      .getRawOne();
    return [todayData, monthlyData];
  }

  async getChartSales(): Promise<KoreaOrders[][]> {
    const thisYearData = await this.koreaOrdersRepository
      .createQueryBuilder()
      .select('DATE(payment_date)', 'payment_date')
      .addSelect('SUM((sale_price - discount_price) * quantity)', 'sales_price')
      .where('payment_date BETWEEN :startDate AND :tomorrow', {
        startDate: DateTime.now().minus({ days: 13 }).toFormat('yyyy-LL-dd'),
        tomorrow: DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd'),
      })
      .andWhere('status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('user_id != "mmzjapan"')
      .groupBy('DATE(payment_date)')
      .getRawMany();
    const beforeYearData = await this.koreaOrdersRepository
      .createQueryBuilder()
      .select('DATE(payment_date)', 'payment_date')
      .addSelect('SUM((sale_price - discount_price) * quantity)', 'sales_price')
      .where('payment_date BETWEEN :startDate AND :tomorrow', {
        startDate: DateTime.now()
          .minus({ years: 1, days: 13 })
          .toFormat('yyyy-LL-dd'),
        tomorrow: DateTime.now()
          .minus({ years: 1 })
          .plus({ days: 1 })
          .toFormat('yyyy-LL-dd'),
      })
      .andWhere('status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('user_id != "mmzjapan"')
      .groupBy('DATE(payment_date)')
      .getRawMany();
    return [thisYearData, beforeYearData];
  }

  async getSquadSales(): Promise<KoreaOrders[][]> {
    const targetDay = DateTime.now().toFormat('yyyy-LL-dd');
    const thisYearMonth = DateTime.now().toFormat('yyyy-LL');
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd');
    const budgetData = await this.koreaBudgetRepository
      .createQueryBuilder('budget')
      .where('YEAR(date) = :year', {
        year: Number(targetDay.substring(0, 4)),
      })
      .andWhere('MONTH(date) = :month', {
        month: Number(targetDay.substring(5, 7)),
      })
      .getRawMany();
    const actualData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .leftJoin(
        Costs,
        'cost',
        'orders.product_variant_id = cost.product_variant_id',
      )
      .leftJoin(Squads, 'squad', 'brand.squad = squad.name')
      .select('squad.id', 'squad_id')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .addSelect(
        'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
        'commission',
      )
      .addSelect(
        'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
        'cost',
      )
      .addSelect('SUM(orders.mileage)', 'mileage')
      .addSelect('SUM(orders.order_coupon)', 'order_coupon')
      .addSelect('SUM(orders.product_coupon)', 'product_coupon')
      .addSelect(
        'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
        'pg_expense',
      )
      .where('orders.payment_date BETWEEN :firstDay AND :tomorrow', {
        firstDay: thisYearMonth + '-01',
        tomorrow: tomorrow,
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('squad.id IS NOT NULL')
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('squad.id')
      .getRawMany();
    const marketingFee = await this.koreaMarketingRepository
      .createQueryBuilder('marketing')
      .leftJoin(Brands, 'brand', 'marketing.brand_id = brand.id')
      .leftJoin(Squads, 'squad', 'brand.squad = squad.name')
      .select('squad.id', 'squad_id')
      .addSelect('SUM(marketing.cost)', 'cost')
      .where('YEAR(marketing.created_at) = :year', {
        year: Number(targetDay.substring(0, 4)),
      })
      .andWhere('MONTH(marketing.created_at) = :month', {
        month: Number(targetDay.substring(5, 7)),
      })
      .andWhere('squad.id IS NOT NULL')
      .groupBy('squad.id')
      .getRawMany();
    return [budgetData, actualData, marketingFee];
  }

  async getBrandSales(dateText): Promise<KoreaOrders[][]> {
    const { startDay, endDay } = dateText;
    const marketingFee = await this.koreaMarketingRepository
      .createQueryBuilder('marketing')
      .select('marketing.brand_id', 'brand_id')
      .addSelect('SUM(marketing.cost)', 'cost')
      .where('marketing.created_at BETWEEN :startDay AND :endDay', {
        startDay,
        endDay,
      })
      .groupBy('marketing.brand_id')
      .getRawMany();
    const brandSalesData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .leftJoin(Suppliers, 'supplier', 'brand.supplier_id = supplier.id')
      .leftJoin(
        Costs,
        'cost',
        'orders.product_variant_id = cost.product_variant_id',
      )
      .select('product.brand_id', 'brand_id')
      .addSelect('brand.name', 'brand_name')
      .addSelect('brand.type', 'brand_type')
      .addSelect('brand.manager_id', 'md_id')
      .addSelect('supplier.id', 'supplier_id')
      .addSelect('supplier.integration_name', 'supplier_name')
      .addSelect('COUNT(DISTINCT(orders.id))', 'order_count')
      .addSelect('SUM(orders.quantity)', 'quantity')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .addSelect(
        'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
        'commission',
      )
      .addSelect(
        'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
        'cost',
      )
      .addSelect('SUM(orders.mileage)', 'mileage')
      .addSelect('SUM(orders.order_coupon)', 'order_coupon')
      .addSelect('SUM(orders.product_coupon)', 'product_coupon')
      .addSelect(
        'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
        'pg_expense',
      )
      .where('orders.payment_date BETWEEN :startDay AND :endDay', {
        startDay,
        endDay,
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('product.brand_id')
      .orderBy('sales_price', 'DESC')
      .getRawMany();
    const logisticFee = await this.koreaOrdersRepository
      .createQueryBuilder('order')
      .leftJoin(Products, 'product', 'order.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .leftJoin(Suppliers, 'supplier', 'brand.supplier_id = supplier.id')
      .leftJoin(
        (logiQuery) => {
          return logiQuery
            .select('logis.id', 'id')
            .addSelect(
              'ROUND((2746 + 2100 + 565) / COUNT(logis.id))',
              'logistic_fixed',
            )
            .from((subQuery) => {
              return subQuery
                .select('order.id', 'id')
                .addSelect('product.brand_id', 'brand_id')
                .leftJoin(Products, 'product', 'order.product_id = product.id')
                .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
                .leftJoin(
                  Suppliers,
                  'supplier',
                  'brand.supplier_id = supplier.id',
                )
                .where('order.payment_date BETWEEN :startDay AND :endDay', {
                  startDay,
                  endDay,
                })
                .andWhere('supplier.id = "1"')
                .andWhere('order.status_id IN (:...ids)', {
                  ids: ['p1', 'g1', 'd1', 'd2', 's1'],
                })
                .groupBy('order.id, product.brand_id');
            }, 'logis')
            .groupBy('logis.id');
        },
        'logi',
        'order.id = logi.id',
      )
      .select('product.brand_id', 'brand_id')
      .addSelect(
        'ROUND(SUM(order.quantity) * 52) + logi.logistic_fixed',
        'logistic_fee',
      )
      .where('order.payment_date BETWEEN :startDay AND :endDay', {
        startDay,
        endDay,
      })
      .andWhere('supplier.id = "1"')
      .andWhere('order.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .groupBy('product.brand_id')
      .getRawMany();
    return [marketingFee, brandSalesData, logisticFee];
  }

  async getProductSales(
    brandId: string,
    dateText: string,
  ): Promise<KoreaOrders[]> {
    let startDay = '';
    if (dateText === 'today') {
      startDay = DateTime.now().toFormat('yyyy-LL-dd');
    } else if (dateText === 'yesterday') {
      startDay = DateTime.now().minus({ days: 1 }).toFormat('yyyy-LL-dd');
    } else if (dateText === 'last_7_days') {
      startDay = DateTime.now().minus({ days: 7 }).toFormat('yyyy-LL-dd');
    } else if (dateText === 'last_14_days') {
      startDay = DateTime.now().minus({ days: 14 }).toFormat('yyyy-LL-dd');
    }
    let productSalesData = [];
    if (brandId == 'moomooz') {
      productSalesData = await this.koreaOrdersRepository
        .createQueryBuilder('orders')
        .leftJoin(Products, 'product', 'orders.product_id = product.id')
        .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
        .leftJoin(
          Costs,
          'cost',
          'orders.product_variant_id = cost.product_variant_id',
        )
        .select('product.name', 'product_name')
        .addSelect('product.image', 'image')
        .addSelect('brand.id', 'brand_id')
        .addSelect('brand.name', 'brand_name')
        .addSelect('brand.type', 'brand_type')
        .addSelect('COUNT(DISTINCT(orders.id))', 'order_count')
        .addSelect('SUM(orders.quantity)', 'quantity')
        .addSelect(
          'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
          'sales_price',
        )
        .addSelect(
          'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
          'commission',
        )
        .addSelect(
          'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
          'cost',
        )
        .addSelect('SUM(orders.mileage)', 'mileage')
        .addSelect('SUM(orders.order_coupon)', 'order_coupon')
        .addSelect('SUM(orders.product_coupon)', 'product_coupon')
        .addSelect(
          'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
          'pg_expense',
        )
        .where('orders.payment_date BETWEEN :startDay AND :endDay', {
          startDay: startDay,
          endDay:
            dateText == 'today'
              ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
              : DateTime.now().toFormat('yyyy-LL-dd'),
        })
        .andWhere('orders.status_id IN (:...ids)', {
          ids: ['p1', 'g1', 'd1', 'd2', 's1'],
        })
        .andWhere('orders.user_id != "mmzjapan"')
        .groupBy('orders.product_id')
        .orderBy('sales_price', 'DESC')
        .getRawMany();
    } else {
      productSalesData = await this.koreaOrdersRepository
        .createQueryBuilder('orders')
        .leftJoin(Products, 'product', 'orders.product_id = product.id')
        .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
        .leftJoin(
          Costs,
          'cost',
          'orders.product_variant_id = cost.product_variant_id',
        )
        .select('product.name', 'product_name')
        .addSelect('product.image', 'image')
        .addSelect('brand.id', 'brand_id')
        .addSelect('brand.name', 'brand_name')
        .addSelect('brand.type', 'brand_type')
        .addSelect('COUNT(DISTINCT(orders.id))', 'order_count')
        .addSelect('SUM(orders.quantity)', 'quantity')
        .addSelect(
          'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
          'sales_price',
        )
        .addSelect(
          'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
          'commission',
        )
        .addSelect(
          'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
          'cost',
        )
        .addSelect('SUM(orders.mileage)', 'mileage')
        .addSelect('SUM(orders.order_coupon)', 'order_coupon')
        .addSelect('SUM(orders.product_coupon)', 'product_coupon')
        .addSelect(
          'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
          'pg_expense',
        )
        .where('orders.payment_date BETWEEN :startDay AND :endDay', {
          startDay: startDay,
          endDay:
            dateText == 'today'
              ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
              : DateTime.now().toFormat('yyyy-LL-dd'),
        })
        .andWhere('orders.status_id IN (:...ids)', {
          ids: ['p1', 'g1', 'd1', 'd2', 's1'],
        })
        .andWhere('product.brand_id = :brandId', { brandId: brandId })
        .andWhere('orders.user_id != "mmzjapan"')
        .groupBy('orders.product_id')
        .orderBy('sales_price', 'DESC')
        .getRawMany();
    }
    if (!productSalesData) {
      throw new NotFoundException(`can't find product sales datas`);
    }
    return productSalesData;
  }

  async getPartnerSales(dateText: string): Promise<KoreaOrders[][]> {
    let startDay = '';
    if (dateText === 'today') {
      startDay = DateTime.now().toFormat('yyyy-LL-dd');
    } else if (dateText === 'yesterday') {
      startDay = DateTime.now().minus({ days: 1 }).toFormat('yyyy-LL-dd');
    } else if (dateText === 'last_7_days') {
      startDay = DateTime.now().minus({ days: 7 }).toFormat('yyyy-LL-dd');
    } else if (dateText === 'last_14_days') {
      startDay = DateTime.now().minus({ days: 14 }).toFormat('yyyy-LL-dd');
    }
    const marketingFee = await this.koreaMarketingRepository
      .createQueryBuilder('marketing')
      .leftJoin(Brands, 'brand', 'marketing.brand_id = brand.id')
      .leftJoin(Suppliers, 'supplier', 'brand.supplier_id = supplier.id')
      .select('supplier.integration_id', 'supplier_id')
      .addSelect('SUM(marketing.cost)', 'cost')
      .where('marketing.created_at BETWEEN :startDay AND :endDay', {
        startDay: startDay,
        endDay:
          dateText == 'today'
            ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
            : DateTime.now().toFormat('yyyy-LL-dd'),
      })
      .groupBy('supplier.integration_id')
      .getRawMany();
    const partnerSalesData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .leftJoin(Suppliers, 'supplier', 'brand.supplier_id = supplier.id')
      .leftJoin(
        Costs,
        'cost',
        'orders.product_variant_id = cost.product_variant_id',
      )
      .select('supplier.integration_id', 'supplier_id')
      .addSelect('supplier.integration_name', 'supplier_name')
      .addSelect('COUNT(DISTINCT(orders.id))', 'order_count')
      .addSelect('SUM(orders.quantity)', 'quantity')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .addSelect(
        'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
        'commission',
      )
      .addSelect(
        'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
        'cost',
      )
      .addSelect('SUM(orders.mileage)', 'mileage')
      .addSelect('SUM(orders.order_coupon)', 'order_coupon')
      .addSelect('SUM(orders.product_coupon)', 'product_coupon')
      .addSelect(
        'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
        'pg_expense',
      )
      .where('orders.payment_date BETWEEN :startDay AND :endDay', {
        startDay: startDay,
        endDay:
          dateText == 'today'
            ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
            : DateTime.now().toFormat('yyyy-LL-dd'),
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('supplier.integration_id != "1"')
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('supplier.integration_id')
      .orderBy('sales_price', 'DESC')
      .getRawMany();
    if (!partnerSalesData) {
      throw new NotFoundException(`can't find partner sales datas`);
    }
    return [marketingFee, partnerSalesData];
  }

  async getMarketing(): Promise<KoreaMarketing[][]> {
    const targetDate = DateTime.now().toFormat('yyyy-LL-dd');
    const salesByChannel = await this.koreaMarketingRepository
      .createQueryBuilder('marketing')
      .select('marketing.channel', 'channel')
      .addSelect('SUM(marketing.cost)', 'cost')
      .addSelect('SUM(marketing.conversion)', 'conversion')
      .where('YEAR(marketing.created_at) = :year', {
        year: Number(targetDate.substring(0, 4)),
      })
      .andWhere('MONTH(marketing.created_at) = :month', {
        month: Number(targetDate.substring(5, 7)),
      })
      .groupBy('marketing.channel')
      .getRawMany();
    const salesByType = await this.koreaMarketingRepository
      .createQueryBuilder('marketing')
      .leftJoin(Brands, 'brand', 'marketing.brand_id = brand.id')
      .select('brand.id', 'brand_id')
      .addSelect('brand.name', 'brand_name')
      .addSelect('SUM(marketing.cost)', 'cost')
      .addSelect('SUM(marketing.conversion)', 'conversion')
      .where('YEAR(marketing.created_at) = :year', {
        year: Number(targetDate.substring(0, 4)),
      })
      .andWhere('MONTH(marketing.created_at) = :month', {
        month: Number(targetDate.substring(5, 7)),
      })
      .groupBy('marketing.brand_id')
      .getRawMany();
    return [salesByChannel, salesByType];
  }

  async getUsers(): Promise<KoreaUsers[]> {
    const targetDate = DateTime.now().minus({ days: 1 }).toFormat('yyyy-LL-dd');
    const targetDateUsers = await this.koreaUsersRepository
      .createQueryBuilder()
      .select('COUNT(id)', 'target_date_users')
      .where('DATE(created_at) = :today', {
        today: targetDate,
      })
      .getRawOne();
    const monthlyUsers = await this.koreaUsersRepository
      .createQueryBuilder()
      .select('COUNT(id)', 'monthly_users')
      .where('YEAR(created_at) = :year', {
        year: Number(targetDate.substring(0, 4)),
      })
      .andWhere('MONTH(created_at) = :month', {
        month: Number(targetDate.substring(5, 7)),
      })
      .getRawOne();
    const totalUsers = await this.koreaUsersRepository
      .createQueryBuilder()
      .select('COUNT(id)', 'total_users')
      .where('DATE(created_at) <= :today', {
        today: targetDate,
      })
      .getRawOne();
    return [targetDateUsers, monthlyUsers, totalUsers];
  }

  async getUserSaleType(): Promise<KoreaOrders[][]> {
    const thisYearMonth = DateTime.now().toFormat('yyyy-LL');
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd');
    const userSaleTypeSum = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .select('orders.is_first', 'is_first')
      .addSelect('COUNT(DISTINCT(orders.user_id))', 'user_count')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .where('orders.payment_date BETWEEN :firstDay AND :tomorrow', {
        firstDay: thisYearMonth + '-01',
        tomorrow: tomorrow,
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('orders.is_first')
      .getRawMany();
    const userSaleTypeData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .select('product.brand_id', 'brand_id')
      .addSelect('brand.name', 'brand_name')
      .addSelect('orders.is_first', 'is_first')
      .addSelect('COUNT(DISTINCT(orders.user_id))', 'user_count')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .where('orders.payment_date BETWEEN :firstDay AND :tomorrow', {
        firstDay: thisYearMonth + '-01',
        tomorrow: tomorrow,
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('orders.is_first')
      .groupBy('product.brand_id')
      .getRawMany();
    if (!userSaleTypeData) {
      throw new NotFoundException(`can't find user sale type datas`);
    }
    return [userSaleTypeSum, userSaleTypeData];
  }

  async getBrandDetail(
    brandId: string,
    dateText: string,
  ): Promise<KoreaOrders[][]> {
    let startDay = '';
    if (dateText === 'today') {
      startDay = DateTime.now().toFormat('yyyy-LL-dd');
    } else if (dateText === 'yesterday') {
      startDay = DateTime.now().minus({ days: 1 }).toFormat('yyyy-LL-dd');
    } else if (dateText === 'last_7_days') {
      startDay = DateTime.now().minus({ days: 7 }).toFormat('yyyy-LL-dd');
    } else if (dateText === 'last_14_days') {
      startDay = DateTime.now().minus({ days: 14 }).toFormat('yyyy-LL-dd');
    }

    const marketingFee = await this.koreaMarketingRepository
      .createQueryBuilder('marketing')
      .select('marketing.brand_id', 'brand_id')
      .addSelect('SUM(marketing.cost)', 'cost')
      .where('marketing.created_at BETWEEN :startDay AND :endDay', {
        startDay: startDay,
        endDay:
          dateText == 'today'
            ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
            : DateTime.now().toFormat('yyyy-LL-dd'),
      })
      .andWhere('marketing.brand_id = :brandId', { brandId: brandId })
      .getRawOne();
    const brandSalesData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(Brands, 'brand', 'product.brand_id = brand.id')
      .leftJoin(Suppliers, 'supplier', 'brand.supplier_id = supplier.id')
      .leftJoin(
        Costs,
        'cost',
        'orders.product_variant_id = cost.product_variant_id',
      )
      .select('product.brand_id', 'brand_id')
      .addSelect('brand.name', 'brand_name')
      .addSelect('brand.type', 'brand_type')
      .addSelect('supplier.id', 'supplier_id')
      .addSelect('supplier.integration_name', 'supplier_name')
      .addSelect('COUNT(DISTINCT(orders.id))', 'order_count')
      .addSelect('SUM(orders.quantity)', 'quantity')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .addSelect(
        'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
        'commission',
      )
      .addSelect(
        'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
        'cost',
      )
      .addSelect('SUM(orders.mileage)', 'mileage')
      .addSelect('SUM(orders.order_coupon)', 'order_coupon')
      .addSelect('SUM(orders.product_coupon)', 'product_coupon')
      .addSelect(
        'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
        'pg_expense',
      )
      .where('orders.payment_date BETWEEN :startDay AND :endDay', {
        startDay: startDay,
        endDay:
          dateText == 'today'
            ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
            : DateTime.now().toFormat('yyyy-LL-dd'),
      })
      .andWhere('product.brand_id = :brandId', { brandId: brandId })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('orders.user_id != "mmzjapan"')
      .getRawOne();
    if (!brandSalesData) {
      throw new NotFoundException(`can't find brand detail datas`);
    }
    const itemSalesData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .leftJoin(
        Costs,
        'cost',
        'orders.product_variant_id = cost.product_variant_id',
      )
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('product.image', 'image')
      .addSelect('COUNT(DISTINCT(orders.id))', 'order_count')
      .addSelect('SUM(orders.quantity)', 'quantity')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .addSelect(
        'ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity * orders.commission_rate / 100))',
        'commission',
      )
      .addSelect(
        'SUM(IF(cost.cost IS NULL, 0, cost.cost) * orders.quantity)',
        'cost',
      )
      .addSelect('SUM(orders.mileage)', 'mileage')
      .addSelect('SUM(orders.order_coupon)', 'order_coupon')
      .addSelect('SUM(orders.product_coupon)', 'product_coupon')
      .addSelect(
        'IF(orders.channel = "shop", ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.032), ROUND(SUM((orders.sale_price - orders.discount_price) * orders.quantity - orders.mileage - orders.order_coupon - orders.product_coupon) * 0.034))',
        'pg_expense',
      )
      .where('orders.payment_date BETWEEN :startDay AND :endDay', {
        startDay: startDay,
        endDay:
          dateText == 'today'
            ? DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd')
            : DateTime.now().toFormat('yyyy-LL-dd'),
      })
      .andWhere('product.brand_id = :brandId', { brandId: brandId })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('product.id')
      .orderBy('sales_price', 'DESC')
      .getRawMany();
    return [marketingFee, brandSalesData, itemSalesData];
  }

  async getBrandChartSales(brandId: string): Promise<KoreaOrders[][]> {
    const thisYearData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .select('DATE(orders.payment_date)', 'payment_date')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .where('orders.payment_date BETWEEN :startDate AND :tomorrow', {
        startDate: DateTime.now().minus({ days: 13 }).toFormat('yyyy-LL-dd'),
        tomorrow: DateTime.now().plus({ days: 1 }).toFormat('yyyy-LL-dd'),
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('product.brand_id = :brandId', { brandId: brandId })
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('DATE(orders.payment_date)')
      .getRawMany();
    const beforeYearData = await this.koreaOrdersRepository
      .createQueryBuilder('orders')
      .leftJoin(Products, 'product', 'orders.product_id = product.id')
      .select('DATE(orders.payment_date)', 'payment_date')
      .addSelect(
        'SUM((orders.sale_price - orders.discount_price) * orders.quantity)',
        'sales_price',
      )
      .where('orders.payment_date BETWEEN :startDate AND :tomorrow', {
        startDate: DateTime.now()
          .minus({ years: 1, days: 13 })
          .toFormat('yyyy-LL-dd'),
        tomorrow: DateTime.now()
          .minus({ years: 1 })
          .plus({ days: 1 })
          .toFormat('yyyy-LL-dd'),
      })
      .andWhere('orders.status_id IN (:...ids)', {
        ids: ['p1', 'g1', 'd1', 'd2', 's1'],
      })
      .andWhere('product.brand_id = :brandId', { brandId: brandId })
      .andWhere('orders.user_id != "mmzjapan"')
      .groupBy('DATE(orders.payment_date)')
      .getRawMany();
    return [thisYearData, beforeYearData];
  }
}
