
export class AllocationService {
  constructor(private storage: DatabaseStorage) {}
  
  async getAllocations(fundId: number) {
    return this.storage.getAllocationsByFund(fundId);
  }
  
  async createAllocation(data: any) {
    return this.storage.createFundAllocation(data);
  }
}

export class FundService {
  constructor(private storage: DatabaseStorage) {}
  
  async getFunds() {
    return this.storage.getAllFunds();
  }
  
  async getFund(id: number) {
    return this.storage.getFundById(id);
  }
}

export class DealService {
  constructor(private storage: DatabaseStorage) {}
  
  async getDeals() {
    return this.storage.getAllDeals();
  }
  
  async getDeal(id: number) {
    return this.storage.getDealById(id);
  }
}