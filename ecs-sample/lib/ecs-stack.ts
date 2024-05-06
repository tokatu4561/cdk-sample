import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';
import { IpAddresses, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as imagedeploy from 'cdk-docker-image-deployment';
import path = require('path');

const resourceName = 'ecs-stack';

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get AWS Account ID and Region
    const { accountId, region } = new cdk.ScopedAws(this);

    // ecr repository
    const ecrRepository = new Repository(this, "EcrRepo", {
      repositoryName: `${resourceName}-ecr-repo`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteImages: true,
    });

    // deploy image to ecr
    new imagedeploy.DockerImageDeployment(this, 'ExampleImageDeploymentWithTag', {
      source: imagedeploy.Source.directory(path.join(__dirname, '..', 'docker', 'nginx')),
      destination: imagedeploy.Destination.ecr(ecrRepository, { 
        tag: 'latest',
      }),
    });

    // vpc and subnet
    const vpc = new Vpc(this, 'Vpc', {
      vpcName: `${resourceName}-Vpc`,
      maxAzs: 2,
      ipAddresses: IpAddresses.cidr('10.0.0.0/20'),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${resourceName}-PublicSubnet`,
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });

    // ecs cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `${resourceName}-Cluster`,
      vpc: vpc,
    });

    // cloudwatch log group
    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/ecs/${resourceName}-LogGroup`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const service = new ecsp.ApplicationLoadBalancedFargateService(this,
      'Service',
      {
        loadBalancerName: `${resourceName}-LoadBalancer`,
        publicLoadBalancer: true,
        cluster: cluster,
        desiredCount: 2,
        serviceName: `${resourceName}-Service`,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
          containerName: `${resourceName}-Container`,
          logDriver: new ecs.AwsLogDriver({
            logGroup: logGroup,
            streamPrefix: `container`,
          }),
        },
      }
    );
  }
}
