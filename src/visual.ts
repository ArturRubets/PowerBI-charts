"use strict";
import {
    select as d3Select
} from "d3-selection";

import {
    scaleLinear,
    scaleBand
} from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { BarChartSettings } from "./settings";
type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import { dataViewObjects, dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import * as d3 from "d3";

const getEvent = () => require("d3-selection").event;
interface data {
    value: powerbi.PrimitiveValue;
    category: powerbi.PrimitiveValue;
    selectionId: ISelectionId;
    color: string;
    id: string,
    idChart: string;
    sizeCircle: number;
    coordinateX?: number;
    coordinateY?: number;
}

interface BarChartDataPoint {
    data: data[]
    color: string;
    selectionId: ISelectionId;
    categoryDisplayName: string,
    measureDisplayName: string
}


interface BarChartViewModel {
    dataPoints: BarChartDataPoint[];
    dataMax: number;
    settings: BarChartSettings;
}

let defaultSettings: BarChartSettings = {
    enableAxisX: {
        show: true,
        fontSize: 16
    },
    enableAxisY: {
        show: true,
        label: true,
        fontSize: 16,
        fontSizeLabel: 14,
        labelText: "Units"
    },
    generalView: {
        opacity: 100,
        dataOnBar: true,
        enableGradient: true
    },
    title: {
        hide: false,
        text: "Sales Forecast",
        fontSizeTitle: 22
    },
    tooltip: {
        fontSizeLabel: 12,
        fontSizeValue: 14
    }
};


function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarChartViewModel {
    let dataViews = options.dataViews;
    let viewModel: BarChartViewModel = {
        dataPoints: [],
        dataMax: 0,
        settings: <BarChartSettings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values
    ) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let category = categorical.categories[0];
    let dataValue = categorical.values;

    let barChartDataPoints: BarChartDataPoint[] = [];
    let dataMax: number;

    let objects = dataViews[0].metadata.objects;

    let barChartSettings: BarChartSettings = {
        enableAxisX: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "show",
            }, defaultSettings.enableAxisX.show),
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "fontSize",
            }, defaultSettings.enableAxisX.fontSize),
        },
        enableAxisY: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "show",
            }, defaultSettings.enableAxisY.show),
            label: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "label",
            }, defaultSettings.enableAxisY.label),
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "fontSize",
            }, defaultSettings.enableAxisY.fontSize),
            fontSizeLabel: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "fontSizeLabel",
            }, defaultSettings.enableAxisY.fontSizeLabel),
            labelText: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "labelText",
            }, defaultSettings.enableAxisY.labelText),
        },
        generalView: {
            opacity: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "opacity" }, defaultSettings.generalView.opacity),
            dataOnBar: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "dataOnBar" }, defaultSettings.generalView.dataOnBar),
            enableGradient: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "enableGradient" }, defaultSettings.generalView.enableGradient),
        },
        title: {
            hide: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "hide" }, defaultSettings.title.hide),
            text: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "text" }, defaultSettings.title.text),
            fontSizeTitle: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "fontSizeTitle" }, defaultSettings.title.fontSizeTitle),
        },
        tooltip: {
            fontSizeLabel: dataViewObjects.getValue(objects, { objectName: "tooltip", propertyName: "fontSizeLabel" }, defaultSettings.tooltip.fontSizeLabel),
            fontSizeValue: dataViewObjects.getValue(objects, { objectName: "tooltip", propertyName: "fontSizeValue" }, defaultSettings.tooltip.fontSizeValue),
        }
    };

    dataMax = Math.max(...dataValue.map(v => <number>v.max || <number>v.maxLocal))


    const defaultColor = {
        solid: {
            blue: "#5065B6",
        }
    };

    for (let i = 0, len = dataValue.length; i < len; i++) {
        //Фильтрую массив столбцов только меры. И перебирая все меры в них находится обьект с значениям цвета
        const color: string = dataViewObjects.getValue<powerbi.Fill>(dataViews[0].metadata.columns.filter(v => v.roles.measure === true)[i].objects, { objectName: "colorSelector", propertyName: "fill" }, { solid: { color: defaultColor.solid.blue } }).solid.color;

        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withMeasure(dataValue[i].source.queryName)
            .createSelectionId();

        let data: {sizeCircle:number, idChart: string, id: string, color: string, value: powerbi.PrimitiveValue, category: powerbi.PrimitiveValue, selectionId: ISelectionId }[] = [];
        for (let y = 0; y < category.values.length; y++) {
            data.push({
                category: category.values[y],
                value: dataValue[i].values[y],
                selectionId: host.createSelectionIdBuilder()
                    .withCategory(category, y)
                    .withMeasure(dataValue[i].source.queryName)
                    .createSelectionId(),
                color: color,
                id: (category.values[y] + '_' + y).replace(/ /g, ''),
                idChart: (i + 1).toString(),
                sizeCircle: 7
            });
        }

        barChartDataPoints.push({
            color: color,
            selectionId,
            data: data,
            measureDisplayName: dataValue[i].source.displayName,
            categoryDisplayName: categorical.categories[0].source.displayName
        });
    }

    return {
        dataPoints: barChartDataPoints,
        dataMax: dataMax,
        settings: barChartSettings
    };
}

export class BarChart implements IVisual {
    private svg: Selection<any>;
    private barContainer: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private host: IVisualHost;
    private element: HTMLElement;
    private selectionManager: ISelectionManager;
    private barChartSettings: BarChartSettings;
    private barDataPoints: BarChartDataPoint[];
    private xAxis: Selection<SVGElement>;
    private yAxis: Selection<SVGElement>;
    private title: Selection<SVGElement>;
    private defs: Selection<SVGElement>;
    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private dataBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;

    private dots: d3.Selection<SVGCircleElement, data, SVGGElement, any>[] = []
    private gradientBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    static Config = {
        solidOpacity: 1,
        transparentOpacity: 0.4,
        // xAxisFontMultiplier: 0.035,
        // yAxisFontMultiplier: 0.035,
        // titleFontMultiplier: 0.05,
        // dataOnBarFontMultiplier: 0.042,
    };



    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.barContainer, <ISelectionId[]>this.selectionManager.getSelectionIds(), [], null, null, 0, null, null);
        });

        this.svg = d3Select(options.element)
            .append('svg')
            .classed('barChart', true);


        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);

        this.yAxis = this.svg
            .append('g')
            .classed('yAxis', true);

        this.barContainer = this.svg
            .append('g')
            .classed('barContainer', true);


        this.defs = this.svg.append('defs')

    }

    public update(options: VisualUpdateOptions) {

        let viewModel: BarChartViewModel = visualTransform(options, this.host);
        //console.log(viewModel);

        let settings = this.barChartSettings = viewModel.settings;
        this.barDataPoints = viewModel.dataPoints;
        let width = options.viewport.width;
        let height = options.viewport.height;

        this.svg.attr("width", width).attr("height", height);

        let paddingTop = height * 0.12
        let paddingBottom = height * 0.12
        let paddingLeft = width * 0.035
        let paddingRight = paddingLeft

        let marginFirstBar = 0
        let marginAxisY = height * 0.035


        let fontSizeAxisX = settings.enableAxisX.fontSize // Math.min(height, width) * BarChart.Config.xAxisFontMultiplier;
        let fontSizeAxisY = settings.enableAxisY.fontSize //Math.min(height, width) * BarChart.Config.yAxisFontMultiplier;
        let fontSizeTitle = settings.title.fontSizeTitle //Math.min(height, width) * BarChart.Config.titleFontMultiplier;
        let fontSizeLabelY = settings.enableAxisY.fontSizeLabel //fontSizeAxisY / 1.2


        this.svg.selectAll('text.title').remove()
        if (!settings.title.hide) {
            this.title = this.svg
                .append('text')
                .text(settings.title.text)
                .classed('title', true)
                .attr("transform", `translate(${paddingLeft - 9}, ${fontSizeAxisY * 2})`)
                .style('font-size', fontSizeTitle)
        }

        //Убираем отступы и оси если пользователь отключил
        if (!settings.enableAxisX.show) {
            paddingBottom = 20
            this.xAxis.classed('remove', true)
        } else {
            this.xAxis.classed('remove', false)
        }

        if (!settings.enableAxisY.show) {
            this.yAxis.classed('remove', true)
            paddingLeft = 0
            paddingRight = 0
        } else {
            this.yAxis.classed('remove', false)
        }


        let heightYAxis = height - paddingTop - paddingBottom
        let widthXAxis = width - paddingLeft - paddingRight


        //Смещение графиков
        this.barContainer.attr('transform', `translate(${paddingLeft * 1.5}, ${paddingTop})`);
        //Смещение оси x
        this.xAxis.attr('transform', `translate(${paddingLeft}, ${heightYAxis + paddingTop})`);
        //Смещение оси y
        this.yAxis.attr('transform', `translate(${paddingLeft}, ${paddingTop})`)


        //функция интерполяции оси Y
        let yScale = scaleLinear()
            .domain([viewModel.dataMax, 0])
            .range([0, heightYAxis - marginAxisY]);
        //функция интерполяции оси X
        let xScale = scaleBand()
            .domain(viewModel.dataPoints[0].data.map(d => <string>d.category))
            .rangeRound([marginFirstBar, widthXAxis])
            .padding(0.7);

        //создаем оси
        let xAxis = axisBottom(xScale);
        let yAxis = axisLeft(yScale).ticks(4);  //ticks - задание количества делений, но движок d3 окончательно сам принимает решение
        this.xAxis.call(xAxis);
        this.yAxis.call(yAxis);

        this.xAxis.style('font-size', fontSizeAxisX)
        this.yAxis.style('font-size', fontSizeAxisY)

        //Удаление названия оси перед его добавлением
        this.yAxis
            .selectAll('text.labelY')
            .remove()

        if (settings.enableAxisY.label) {
            //Добавление названия оси Y
            this.yAxis
                .select('g.tick')
                .append('text')
                .classed('labelY', true)
                .attr('x', -9)  // значения на оси x имеют атрибут x = -9
                .attr('y', -heightYAxis * 0.1)
                .attr('font-size', settings.enableAxisY.fontSizeLabel)
                .text(settings.enableAxisY.labelText)
        }

        // рисуем горизонтальные линии 
        this.yAxis.selectAll(".tick line")
            .classed("grid-line", true)
            .attr("x1", -10)    // для того чтобы линия начиналась от начала значения на оси Y
            .attr("y1", -fontSizeAxisY)    // для того чтобы линия стояла над значением на оси Y
            .attr("x2", widthXAxis) // ширина линии равняется ширине оси Xs
            .attr("y2", -10);   // для того чтобы линия стояла над значением на оси Y

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)



        const opacity: number = viewModel.settings.generalView.opacity / 100;

        //----- Создание градиента

        this.gradientBarSelection = this.defs
            .selectAll('linearGradient')
            .data(this.barDataPoints);


        const gradientBarSelectionMerged = this.gradientBarSelection
            .enter()
            .append("linearGradient")
            .merge(<any>this.gradientBarSelection)

        gradientBarSelectionMerged
            .attr("id", (dataPoint: BarChartDataPoint, i: number) => `Gradient${i + 1}`)  //Индекс для того чтобы для каждого bar был свой элемент linearGradient нужно прописать айди уникальный
            .attr("x1", "0")    //Координаты заливки чтобы залить вертикально сверху вниз
            .attr("x2", "0")
            .attr("y1", "0")
            .attr("y2", "1")


        gradientBarSelectionMerged.selectAll('stop').remove()   //При обновлении удаляем элементы stop и дальше заменяем их обновленными

        gradientBarSelectionMerged
            .append("stop")
            .attr("offset", "0%")   //Начать с этого цвета 
            .attr("stop-color", (dataPoint: BarChartDataPoint) => dataPoint.color)


        if (settings.generalView.enableGradient) {
            gradientBarSelectionMerged
                .append('stop')
                .attr("offset", "95%") //Закончить этим цветом
                .attr("stop-color", "white")
        }

        //-----------------  Создание градиента



        //-------- Создание диаграммы
        this.barContainer.selectAll(".axis").remove();
        viewModel.dataPoints.forEach((d, i) =>
            this.createChart(d, i + 1, xScale, yScale, this.barContainer)
        );

        //------------------  Создание диаграммы


        if (this.isClicked()) {

            let rects = this.barContainer.selectAll('rect.clicked')

            

            console.log(rects.attr('id'));
            
            
            
            // rects.each((d:data, i) => {

            //     if (this.host.hostCapabilities.allowInteractions) {

            //         this.createTooltip(viewModel, d, xScale, fontSizeAxisY, fontSizeLabelY,
            //             settings)
            //         this.createRectTooltip(d, xScale, yScale, heightYAxis)

            //     }

            // })
        }

        this.dots.forEach((d, i) =>
            d.on('click', (d) => {
                if (this.host.hostCapabilities.allowInteractions) {
                    // const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                    // this.selectionManager
                    //     .select(d.selectionId, isCtrlPressed)
                    //     .then((ids: ISelectionId[]) => {
                    //         this.syncSelectionState(this.barContainer.selectAll('g'), ids,
                    //             [this.xAxis.selectAll('g.tick text')],
                    //             xScale,
                    //             yScale,
                    //             heightYAxis,
                    //             this.barContainer,
                    //             {
                    //                 viewModel,
                    //                 fontSizeAxisY,
                    //                 fontSizeLabelY,
                    //                 settings
                    //             });
                    //     });
                    // (<Event>getEvent()).stopPropagation();

                    this.createRectTooltip(d, xScale, yScale, heightYAxis)
                }
            })
        );


        // this.dots.forEach((d, i) =>
        //     d.on('mouseover', (dotOver: data) => {
        //         if (this.host.hostCapabilities.allowInteractions) {
        //             if (!this.isClicked()) {
        //                 this.createTooltip(viewModel, dotOver, xScale, fontSizeAxisY, fontSizeLabelY,
        //                     settings)
        //                 this.createRectTooltip(dotOver, xScale, yScale, heightYAxis)
        //             }
        //         }
        //     })
        // );


        // this.dots.forEach((d, i) =>
        //     d.on('mouseout', (dotOver: BarChartDataPoint) => {
        //         if (!this.isClicked()) {
        //             this.removetooltip()
        //             this.removeRectTooltip()
        //         }
        //     })
        // );


        this.barSelection.exit().remove();
        this.dataBarSelection.exit().remove();
        this.gradientBarSelection.exit().remove();

    }


    private isClicked() {
        return this.barContainer.selectAll('rect.clicked').size()
    }

    private createChart(data: BarChartDataPoint, index: number, xScale: d3.ScaleBand<string>,
        yScale: d3.ScaleLinear<number, number, never>, barContainer: d3.Selection<d3.BaseType, any, d3.BaseType, any>) {

        // функция, создающая по массиву точек линии
        var line = d3.line<{ category: string, value: number }>()
            .x((d) => xScale(d.category))
            .y((d) => yScale(d.value))
            .curve(d3.curveCardinal);

        var g = barContainer.append("g")
            .attr("class", "axis")


        let dataTransform = data.data.map(d => ({ category: <string>d.category, value: <number>d.value }))
        g.append("path")
            .attr("d", line(dataTransform))
            .style("stroke", data.color)
            .style("stroke-width", 3.5);

        // добавляем отметки к точкам
        let dot = g.selectAll(".dot")
            .data(data.data)
            .enter().append("circle")
            .style("stroke", "white")
            .style("stroke-width", 3.5)
            .style("fill", data.color)
            .attr('id', d => d.id)
            .attr("r", d => d.sizeCircle)
            .attr("cx", (d) => {let x = xScale(<string>d.category); d.coordinateX = x; return  x})
            .attr("cy", (d) => {let y = yScale(<number>d.value); d.coordinateY = y; return y});

        this.dots.push(dot)
    };


    private syncSelectionState(
        selection: Selection<BarChartDataPoint>,
        selectionIds: ISelectionId[],
        additionalElements: Selection<any>[],
        xScale: d3.ScaleBand<string>,
        yScale: d3.ScaleLinear<number, number, never>,
        heightYAxis: number,
        barContainer: d3.Selection<d3.BaseType, any, d3.BaseType, any>,
        paramTooltip: { viewModel, fontSizeAxisY, fontSizeLabelY, settings }
    ): void {
        if (!selection || !selectionIds) {
            return;
        }

        this.removeRectTooltip()
        this.removetooltip()


        //Сразу ось Х имеет прозрачность
        additionalElements.forEach(e =>
            e.style("fill-opacity", BarChart.Config.transparentOpacity)
                .style("stroke-opacity", BarChart.Config.transparentOpacity)
        )

        //Если не выбран элемент то все без прозрачности
        if (!selectionIds.length) {
            additionalElements.forEach(e =>
                e.style("fill-opacity", BarChart.Config.solidOpacity)
                    .style("stroke-opacity", BarChart.Config.solidOpacity)
            )
          //  this.barContainer.selectAll('.clicked').classed('clicked', false)
            return;
        }
        else {
            const self: this = this;
            selection.each(function (groupDataPoint, indexGroup: number) {
                let group = d3Select(this)
                let circles: Selection<data> = group.selectAll('circle')

                let dots:data[] = []
                circles.each(function (barDataPoint: data, indexDot: number) {
                    const isSelected: boolean = self.isSelectionIdInArray(selectionIds, barDataPoint.selectionId);

                    if (isSelected) {
                        dots.push(barDataPoint)

                        additionalElements.forEach(e =>
                            e.filter((d, i) => i === indexDot)
                                .style("fill-opacity", BarChart.Config.solidOpacity)
                                .style("stroke-opacity", BarChart.Config.solidOpacity)
                        )


                        self.createTooltip(paramTooltip.viewModel, barDataPoint, xScale, paramTooltip.fontSizeAxisY, paramTooltip.fontSizeLabelY, paramTooltip.settings)
                        self.barContainer.selectAll('rect.selected').classed('clicked', true).attr("id", barDataPoint.id)
                    }
                })
                self.createRectTooltip(dots, xScale, yScale, heightYAxis)
            });

        }

    }


    private createTooltip(viewModel, dotOver: data, xScale, fontSizeAxisY, fontSizeLabelY,
        settings) {

        let indexChart, indexDot;
        viewModel.dataPoints.forEach((chart, i) => {
            if (chart.selectionId.includes(dotOver.selectionId)) {
                indexChart = i
                chart.data.forEach((dot, i) => {
                    if (dot.selectionId.equals(dotOver.selectionId)) {
                        indexDot = i
                    }
                })
            }
        })

        let findChart = this.barContainer.selectAll('.axis')
            .filter((d, i) => i === indexChart)

        let findDot = findChart
            .selectAll('circle')
            .filter((d, i) => i === indexDot)


        let widthTooltip = xScale.bandwidth() * 2
        let heightTooltip = fontSizeAxisY * 3
        let coordinateX = parseInt(findDot.attr('cx')) - widthTooltip / 2
        let coordinateY = parseInt(findDot.attr('cy')) - heightTooltip - fontSizeAxisY / 2

        let fontSizeLabel = fontSizeLabelY
        let fontSizeValue = fontSizeAxisY

        let tooltip = this.barContainer.append('g')
            .classed('tooltip', true)

        tooltip.append('rect')
            .attr('x', coordinateX)
            .attr('y', coordinateY)
            .attr('width', widthTooltip)
            .attr('height', heightTooltip)
            .attr('rx', 7)
            .style('fill', 'white')

        let lable =
            tooltip.append('text')
                .classed('yAxis', true)
                .attr('x', coordinateX + widthTooltip / 2)
                .attr('y', coordinateY + heightTooltip / 2.5)
                .attr('font-size', settings.tooltip.fontSizeLabel)
                .attr('text-anchor', 'middle')
                .text('Sales')


        let value =
            tooltip.append('text')
                .style('fill-opacity', 0.8)
                .style('font-weight', 600)
                .attr('x', coordinateX + widthTooltip / 2)
                .attr('y', coordinateY + heightTooltip / 1.3)
                .attr('font-size', settings.tooltip.fontSizeValue)
                .attr('text-anchor', 'middle')
                .text(dotOver.value.toString())
                .style('fill', dotOver.color)

        let coordinateXTriangle = coordinateX + widthTooltip / 2.5
        let coordinateYTriangle = coordinateY + heightTooltip * 0.99
        let width = widthTooltip / 5
        let height = heightTooltip / 7
        let triangle = tooltip
            .append('polygon')
            .attr('points',
                `${coordinateXTriangle},${coordinateYTriangle} ${coordinateXTriangle + width / 2},${coordinateYTriangle + height} ${coordinateXTriangle + width},${coordinateYTriangle}`
            )
            .style('fill', 'white')
    }

    private removetooltip() {
        this.barContainer.selectAll('.tooltip').remove()
    }

    private createRectTooltip(dots: data[], xScale, yScale, heightYAxis) {
        //let sizeCircle = parseInt(this.barContainer.select('#' + dot.id).attr('r'))

        // this.barContainer.insert('rect', 'g')
        //     .classed('selected', true)
        //     .attr('rx', 20)
        //     .attr("width", xScale.bandwidth())
        //     .attr("height", heightYAxis - yScale(<number>dot.value))
        //     .attr("y", yScale(<number>dot.value) - sizeCircle * 2.5)
        //     .attr("x", xScale(<string>dot.category) - xScale.bandwidth() / 2)
        //     .attr("fill", `url(#Gradient${dot.idChart})`)
        //     .style("fill-opacity", 0.2)

        console.log(dots);
        
        this.barContainer
            .selectAll('.selected')
            .data(dots)
            .enter()
            .insert('rect', 'g')
            .classed('selected', true)
            .attr('rx', 20)
            .attr("width", xScale.bandwidth())
            .attr("height", dot => heightYAxis - yScale(<number>dot.value))
            .attr("y", dot =>  yScale(<number>dot.value) - dot.sizeCircle * 2.5)
            .attr("x",  dot => xScale(<string>dot.category) - xScale.bandwidth() / 2)
            .attr("fill", dot => `url(#Gradient${dot.idChart})`)
            .style("fill-opacity", 0.2)


            // let dot = g.selectAll(".dot")
            // .data(data.data)
            // .enter().append("circle")
            // .style("stroke", "white")
            // .style("stroke-width", 3.5)
            // .style("fill", data.color)
            // .attr('id', d => d.id)
            // .attr("r", 7)
            // .attr("cx", (d) => xScale(<string>d.category))
            // .attr("cy", (d) => yScale(<number>d.value));
    }

    private removeRectTooltip() {
        this.barContainer.selectAll('rect.selected').remove()
    }

    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.equals(selectionId);
        });
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.barChartSettings ||
            !this.barChartSettings.enableAxisX ||
            !this.barChartSettings.enableAxisY ||
            !this.barDataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'title':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        text: this.barChartSettings.title.text,
                        hide: this.barChartSettings.title.hide,
                        fontSizeTitle: this.barChartSettings.title.fontSizeTitle
                    },
                    validValues: {
                        fontSizeTitle: {
                            numberRange: {
                                min: 6,
                                max: 40
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'enableAxisX':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisX.show,
                        fontSize: this.barChartSettings.enableAxisX.fontSize
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'enableAxisY':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisY.show,
                        label: this.barChartSettings.enableAxisY.label,
                        fontSize: this.barChartSettings.enableAxisY.fontSize,
                        fontSizeLabel: this.barChartSettings.enableAxisY.fontSizeLabel,
                        labelText: this.barChartSettings.enableAxisY.labelText
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        },
                        fontSizeLabel: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'colorSelector':

                for (let barDataPoint of this.barDataPoints) {
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: barDataPoint.measureDisplayName,
                        properties: {
                            fill: {
                                solid: {
                                    color: barDataPoint.color
                                }
                            }
                        },
                        selector: barDataPoint.selectionId.getSelector()
                    });
                }
                break;
            case 'generalView':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        opacity: this.barChartSettings.generalView.opacity,
                        dataOnBar: this.barChartSettings.generalView.dataOnBar,
                        enableGradient: this.barChartSettings.generalView.enableGradient
                    },
                    validValues: {
                        opacity: {
                            numberRange: {
                                min: 10,
                                max: 100
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'tooltip':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fontSizeLabel: this.barChartSettings.tooltip.fontSizeLabel,
                        fontSizeValue: this.barChartSettings.tooltip.fontSizeValue,
                    },
                    validValues: {
                        fontSizeLabel: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        },
                        fontSizeValue: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
        };

        return objectEnumeration;
    }
}