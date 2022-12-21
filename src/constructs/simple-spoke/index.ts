import { Construct } from 'constructs';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import SimpleVNet from '../simple-vnet/index.js';

class SimpleSpoke extends Construct {
  public spokeRg: ResourceGroup;

  public simpleSpokeVNet: SimpleVNet;

  constructor(scope: Construct, name: string, options: {
    region: string
    vNetAddressSpace: string[],
    subnetAddressPrefixes: string[],
  }) {
    super(scope, name);

    const tags = {
      environment: 'dev',
    };

    this.spokeRg = new ResourceGroup(
      this,
      'spoke-example-rg',
      {
        location: options.region,
        name: 'spoke-example-rg',
        tags,
      },
    );

    this.simpleSpokeVNet = new SimpleVNet(this, 'spoke-vnet', {
      resourceGroup: this.spokeRg,
      vNetName: 'spoke-network',
      vNetAddressSpace: options.vNetAddressSpace,
      subnetAddressPrefixes: options.subnetAddressPrefixes,
      tags,
    });
  }
}

export default SimpleSpoke;
