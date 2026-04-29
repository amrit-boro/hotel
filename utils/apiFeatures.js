class APIFeatures {
  constructor(mongooseQuery, queryString) {
    this.query = mongooseQuery; // e.g., MenuItem.find()
    this.queryString = queryString; // req.query
  }

  // 1. Filtering (category, veg, hotelId, price range, etc.)
  filter() {
    const queryObj = { ...this.queryString }; // Clone

    // Fields to exclude from filtering
    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Advanced filtering (gte, gt, lte, lt)
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    let parsedQuery = JSON.parse(queryStr); // Back to Object
    // Case-insensitive category
    if (parsedQuery.category) {
      parsedQuery.category = {
        $regex: `^${parsedQuery.category}$`,
        $options: "i",
      };
    }

    // Convert veg string → boolean
    if (parsedQuery.veg !== undefined) {
      parsedQuery.veg = parsedQuery.veg === "true"; // if parsedQuery.veg is true then true === true : return true otherwise false
    }

    this.query = this.query.find(parsedQuery);
    return this;
  }

  // 2. Search (name + description)
  search() {
    if (this.queryString.search) {
      const search = this.queryString.search;

      this.query = this.query.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      });
    }

    return this;
  }

  // 3. Sorting
  sort() {
    if (this.queryString.sort) {
      // e.g. sort=price,-ratings.average
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt"); // default
    }

    return this;
  }

  // 4. Field limiting (projection)
  limitFields() {
    if (this.queryString.fields) {
      // e.g. fields=name,price,ratings
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }

    return this;
  }

  // 5. Pagination
  paginate() {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || 10;
    const skip = (page - 1) * limit;

    this.page = page;
    this.limit = limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
