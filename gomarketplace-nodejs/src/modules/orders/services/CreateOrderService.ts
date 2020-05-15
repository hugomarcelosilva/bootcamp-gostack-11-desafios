import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomer = await this.customersRepository.findById(customer_id);
    if (!checkCustomer) {
      throw new AppError('Invalid Customer ID');
    }

    const searchedProduct = await this.productsRepository.findAllById(products);
    if (searchedProduct.length !== products.length) {
      throw new AppError('Products does not exists');
    }

    const checkStock = products.filter(product => {
      const storedProduct = searchedProduct.find(
        findProduct => findProduct.id === product.id,
      );

      return (
        storedProduct &&
        storedProduct.id === product.id &&
        storedProduct.quantity - product.quantity < 0
      );
    });

    if (checkStock.length > 0) {
      throw new AppError('Some of ordered products are out of stock');
    }

    const productsInOrder = products.map(product => {
      return {
        product_id: product.id,
        price:
          searchedProduct[
            searchedProduct.findIndex(item => item.id === product.id)
          ].price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer: checkCustomer,
      products: productsInOrder,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateProductService;
