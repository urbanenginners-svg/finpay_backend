import axios, { isAxiosError } from 'axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import type {
  PostFormUrlEncodedParams,
  SuccessEnvelope,
} from './http-form.types';

@Injectable()
export class HttpFormService {
  private readonly logger = new Logger(HttpFormService.name);

  /**
   * POST `application/x-www-form-urlencoded` and return the response body.
   */
  async postFormUrlEncoded<T>(params: PostFormUrlEncodedParams): Promise<T> {
    const {
      url,
      body,
      headers,
      context = url,
      errorMessage = 'Request failed. Please try again later.',
    } = params;

    try {
      const response = await axios.post<T>(url, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          ...headers,
        },
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        this.logger.error(
          `HTTP ${response.status} [${context}]: ${JSON.stringify(response.data)}`,
        );
        throw new InternalServerErrorException(errorMessage);
      }

      return response.data;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const detail = isAxiosError(error)
        ? JSON.stringify(error.response?.data ?? error.message)
        : error instanceof Error
          ? error.message
          : String(error);
      this.logger.error(`Request failed [${context}]: ${detail}`);
      throw new InternalServerErrorException(errorMessage);
    }
  }

  /**
   * POST form data and unwrap APIs that respond with `{ success, data }`.
   */
  async postFormWithSuccessEnvelope<T>(
    params: PostFormUrlEncodedParams,
  ): Promise<T> {
    const {
      context = params.url,
      errorMessage = 'Request failed. Please try again later.',
    } = params;

    const envelope = await this.postFormUrlEncoded<SuccessEnvelope<T>>(params);

    if (!envelope?.success) {
      this.logger.error(
        `API error [${context}]: ${JSON.stringify(envelope)}`,
      );
      throw new InternalServerErrorException(errorMessage);
    }

    return envelope.data;
  }
}
