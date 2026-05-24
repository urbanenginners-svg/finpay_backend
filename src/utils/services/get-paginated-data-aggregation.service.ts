import { Model, PipelineStage } from "mongoose";
import { PageMeta } from "../response/page-meta";
import { QueryCommonFields } from "../interfaces/query-fields.interface";

export const getPaginatedDataWithAggregation = async <T>(
  repository: Model<T>,
  query: QueryCommonFields,
  aggregationPipeline: PipelineStage[],
  sort: { createdAt: -1 } | { createdAt: 1 } | { referenceNumber: -1 } | { referenceNumber: 1 } = { createdAt: -1 },
): Promise<[T[], PageMeta]> => {
  const { limit = 10, page = 1 } = query;

  // Create pipeline for counting total documents
  const countPipeline = [...aggregationPipeline, { $count: "total" }];

  // Add pagination to the main pipeline
  const dataPipeline = [
    ...aggregationPipeline,
    { $sort: sort },
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) },
  ];

  const [data, countResult] = await Promise.all([
    repository.aggregate(dataPipeline),
    repository.aggregate(countPipeline),
  ]);

  const itemCount = countResult.length > 0 ? countResult[0].total : 0;
  const meta = new PageMeta(itemCount, query);

  return [data as T[], meta];
};
