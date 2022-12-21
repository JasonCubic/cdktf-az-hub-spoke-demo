import { Construct } from 'constructs';
import { Fn } from 'cdktf';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import { RouteTable } from '@cdktf/provider-azurerm/lib/route-table/index.js';
import { SubnetRouteTableAssociation } from '@cdktf/provider-azurerm/lib/subnet-route-table-association/index.js';
import { NetworkInterface } from '@cdktf/provider-azurerm/lib/network-interface/index.js';
import { VirtualMachine } from '@cdktf/provider-azurerm/lib/virtual-machine/index.js';
import { VirtualMachineExtension } from '@cdktf/provider-azurerm/lib/virtual-machine-extension/index.js';
import { Subnet } from '@cdktf/provider-azurerm/lib/subnet/index.js';
import MicrosoftSpoke from '../L2-microsoft-spoke/index.js';
import capitalizeString from '../../utils/capitalize-string.js';

// Original: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-hub-nva

class MicrosoftHubNVA extends Construct {
  constructor(scope: Construct, name: string, options: {
    hubNvaLocation: string,
    prefixHubNva: string,
    hubDmzSubnet: Subnet,
    subnetHubGatewaySubnet: Subnet,
    spokeConstructs: MicrosoftSpoke[],
    adminUsername: string,
    adminPassword: string,
  }) {
    super(scope, name);

    const hubNvaRg = new ResourceGroup(this, 'hub-nva-rg', {
      location: options.hubNvaLocation,
      name: `${options.prefixHubNva}-rg`,
      tags: {
        environment: options.prefixHubNva,
      },
    });

    const hubGatewayRtSpokeRoutes = options.spokeConstructs.map((spokeConstruct) => ({
      // addressPrefix: spokeConstruct.spokeVnet.addressSpace[0],
      addressPrefix: Fn.element(spokeConstruct.spokeVnet.addressSpace, 0),
      name: `to${capitalizeString(spokeConstruct.prefixSpoke)}`,
      nextHopInIpAddress: '10.0.0.36',
      nextHopType: 'VirtualAppliance',
    }));

    const hubGatewayRt = new RouteTable(this, 'hub-gateway-rt', {
      disableBgpRoutePropagation: false,
      location: hubNvaRg.location,
      name: 'hub-gateway-rt',
      resourceGroupName: hubNvaRg.name,
      route: [
        {
          addressPrefix: '10.0.0.0/16',
          name: 'toHub',
          nextHopType: 'VnetLocal',
        },
        ...hubGatewayRtSpokeRoutes,
      ],
      tags: {
        environment: options.prefixHubNva,
      },
    });

    new SubnetRouteTableAssociation(this, 'hub-gateway-rt-hub-vnet-gateway-subnet', {
      dependsOn: [options.subnetHubGatewaySubnet],
      routeTableId: hubGatewayRt.id,
      subnetId: options.subnetHubGatewaySubnet.id,
    });

    for (let j = 0; j < options.spokeConstructs.length; j += 1) {
      const spokeConstruct = options.spokeConstructs[j];
      const { prefixSpoke } = spokeConstruct;
      const otherHubGatewayRtSpokeRoutes = hubGatewayRtSpokeRoutes.filter((row) => row.name !== `to${capitalizeString(prefixSpoke)}`);

      const spokeRt = new RouteTable(this, `${spokeConstruct.prefixSpoke}-rt`, {
        name: `${spokeConstruct.prefixSpoke}-rt`,
        location: hubNvaRg.location,
        resourceGroupName: hubNvaRg.name,
        disableBgpRoutePropagation: false,
        route: [
          ...otherHubGatewayRtSpokeRoutes,
          {
            addressPrefix: '0.0.0.0/0',
            name: 'default',
            nextHopType: 'VnetLocal',
          },
        ],
        tags: {
          environment: options.prefixHubNva,
        },
      });

      new SubnetRouteTableAssociation(this, `${prefixSpoke}-rt-${prefixSpoke}-vnet-mgmt`, {
        dependsOn: [spokeConstruct.mgmtSubnet],
        routeTableId: spokeRt.id,
        subnetId: spokeConstruct.mgmtSubnet.id,
      });

      new SubnetRouteTableAssociation(this, `${prefixSpoke}-rt-${prefixSpoke}-vnet-workload`, {
        dependsOn: [spokeConstruct.workloadSubnet],
        routeTableId: spokeRt.id,
        subnetId: spokeConstruct.workloadSubnet.id,
      });
    }

    const hubNvaNic = new NetworkInterface(this, 'hub-nva-nic', {
      name: `${options.prefixHubNva}-nic`,
      location: hubNvaRg.location,
      resourceGroupName: hubNvaRg.name,
      enableIpForwarding: true,
      ipConfiguration: [{
        name: options.prefixHubNva,
        privateIpAddress: '10.0.0.36',
        privateIpAddressAllocation: 'Static',
        subnetId: options.hubDmzSubnet.id,
      }],
      tags: {
        environment: options.prefixHubNva,
      },
    });

    const hubNvaVm = new VirtualMachine(this, `${options.prefixHubNva}-vm`, {
      name: `${options.prefixHubNva}-vm`,
      location: hubNvaRg.location,
      resourceGroupName: hubNvaRg.name,
      networkInterfaceIds: [hubNvaNic.id],
      osProfile: {
        adminUsername: options.adminUsername,
        adminPassword: options.adminPassword,
        computerName: `${options.prefixHubNva}-vm`,
      },
      osProfileLinuxConfig: {
        disablePasswordAuthentication: false,
      },
      storageImageReference: {
        offer: 'UbuntuServer',
        publisher: 'Canonical',
        sku: '16.04-LTS',
        version: 'latest',
      },
      storageOsDisk: {
        name: `${options.prefixHubNva}-vm-os-disk-1`,
        caching: 'ReadWrite',
        createOption: 'FromImage',
        managedDiskType: 'Standard_LRS',
      },
      deleteOsDiskOnTermination: true,
      tags: {
        environment: options.prefixHubNva,
      },
      vmSize: 'Standard_B1s',
    });

    new VirtualMachineExtension(this, 'enable-routes', {
      name: 'enable-iptables-routes',
      publisher: 'Microsoft.Azure.Extensions',
      settings: `{
        "fileUris": [
          "https://raw.githubusercontent.com/mspnp/reference-architectures/master/scripts/linux/enable-ip-forwarding.sh"
        ],
        "commandToExecute": "bash enable-ip-forwarding.sh"
      }`,
      tags: {
        environment: options.prefixHubNva,
      },
      type: 'CustomScript',
      typeHandlerVersion: '2.0',
      virtualMachineId: hubNvaVm.id,
    });
  }
}

export default MicrosoftHubNVA;
