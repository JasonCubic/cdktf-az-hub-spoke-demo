import { Construct } from 'constructs';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import SimpleVNet from '../simple-vnet/index.js';

class SimpleHub extends Construct {
  public hubRg: ResourceGroup;

  public simpleHubVNet: SimpleVNet;

  constructor(scope: Construct, name: string, options: {
    region: string
    vNetAddressSpace: string[],
    subnetAddressPrefixes: string[],
  }) {
    super(scope, name);

    const tags = {
      environment: 'dev',
    };

    this.hubRg = new ResourceGroup(
      this,
      'hub-example-rg',
      {
        location: options.region,
        name: 'hub-example-rg',
        tags,
      },
    );

    this.simpleHubVNet = new SimpleVNet(this, 'hub-vnet', {
      resourceGroup: this.hubRg,
      vNetName: 'hub-network',
      vNetAddressSpace: options.vNetAddressSpace,
      subnetAddressPrefixes: options.subnetAddressPrefixes,
      tags,
    });
  }
}

export default SimpleHub;
